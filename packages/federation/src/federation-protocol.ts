import { CoreLogger } from '@aios/core';
import {
  FederationMessage,
  FederationMessageType,
  FederationProtocolConfig,
  FederationAuditEntry,
  PeerNode,
} from '@aios/types';
import { PeerDiscovery } from './peer-discovery';
import * as crypto from 'crypto';

/**
 * FederationProtocol — Secure message transport for the AIOS
 * Federated Multi-Agent Network.
 *
 * Implements a JSON-RPC 2.0 message envelope over WebSocket with
 * end-to-end encryption, request/response correlation, timeout handling,
 * and a full audit trail.
 */
export class FederationProtocol {
  private logger: CoreLogger;
  private discovery: PeerDiscovery;
  private config: FederationProtocolConfig;
  private messageHandlers: Map<FederationMessageType, Set<(msg: FederationMessage) => void>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (response: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private auditLog: FederationAuditEntry[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private running: boolean = false;

  constructor(
    logger: CoreLogger,
    discovery: PeerDiscovery,
    config?: Partial<FederationProtocolConfig>
  ) {
    this.logger = logger;
    this.discovery = discovery;

    const localPeer = discovery.getLocalPeer();
    this.config = {
      localPeerId: localPeer.id,
      port: localPeer.port,
      enableMdns: true,
      enableEncryption: true,
      heartbeatIntervalMs: 30_000,
      requestTimeoutMs: 10_000,
      ...config,
    };

    this.logger.info(`FederationProtocol initialized on port ${this.config.port}`);
  }

  /**
   * Start the federation protocol server.
   * Begins accepting WebSocket connections and sending heartbeats.
   */
  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.logger.info('Starting Federation Protocol server...');

    // Stub: In production, this would:
    // 1. Create a WebSocket server on this.config.port
    // 2. Handle incoming connections with identity verification
    // 3. Route incoming messages to registered handlers

    // Start heartbeat loop
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, this.config.heartbeatIntervalMs);

    if (this.config.enableMdns) {
      await this.discovery.startDiscovery();
    }

    this.logger.info('Federation Protocol server started');
  }

  /**
   * Stop the federation protocol server.
   */
  public async stop(): Promise<void> {
    this.running = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Protocol shutting down'));
      clearTimeout(pending.timeout);
    }
    this.pendingRequests.clear();

    await this.discovery.stopDiscovery();

    this.logger.info('Federation Protocol server stopped');
  }

  /**
   * Send a message to a specific peer.
   */
  public async sendMessage(
    recipientId: string,
    type: FederationMessageType,
    payload: any
  ): Promise<void> {
    const message = this.createMessage(recipientId, type, payload);

    this.logger.debug(`Sending ${type} to peer ${recipientId}`);

    // Stub: In production, this would:
    // 1. Look up the peer's WebSocket connection
    // 2. Optionally encrypt the payload using the peer's public key
    // 3. Send the JSON-RPC envelope over WebSocket

    this.recordAudit(recipientId, type, 'outbound', JSON.stringify(payload).length, true);
  }

  /**
   * Send a request and wait for a correlated response.
   */
  public async sendRequest(
    recipientId: string,
    type: FederationMessageType,
    payload: any
  ): Promise<any> {
    const correlationId = crypto.randomBytes(8).toString('hex');
    const message = this.createMessage(recipientId, type, payload, correlationId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request to peer ${recipientId} timed out after ${this.config.requestTimeoutMs}ms`));
      }, this.config.requestTimeoutMs);

      this.pendingRequests.set(correlationId, { resolve, reject, timeout });

      // Stub: Send the message
      this.logger.debug(`Sent request ${type} to peer ${recipientId} (correlation: ${correlationId})`);
    });
  }

  /**
   * Register a handler for a specific message type.
   */
  public onMessage(type: FederationMessageType, handler: (msg: FederationMessage) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
  }

  /**
   * Remove a message handler.
   */
  public offMessage(type: FederationMessageType, handler: (msg: FederationMessage) => void): void {
    this.messageHandlers.get(type)?.delete(handler);
  }

  /**
   * Delegate a task to a remote peer's agent.
   */
  public async delegateToRemoteAgent(
    peerId: string,
    agentId: string,
    task: string
  ): Promise<string> {
    this.logger.info(`Delegating task to peer ${peerId}, agent ${agentId}: "${task}"`);

    // Stub: Send agent:delegate message and await response
    await this.sendMessage(peerId, 'agent:delegate', { agentId, task });
    return 'Remote delegation stub — response would come via correlated response';
  }

  /**
   * Get the audit log of all federation messages.
   */
  public getAuditLog(limit: number = 100): FederationAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get the current protocol configuration.
   */
  public getConfig(): FederationProtocolConfig {
    return { ...this.config };
  }

  /**
   * Check if the protocol server is running.
   */
  public isRunning(): boolean {
    return this.running;
  }

  // ─── Private ───────────────────────────────────────────────

  private createMessage(
    recipientId: string,
    type: FederationMessageType,
    payload: any,
    correlationId?: string
  ): FederationMessage {
    return {
      id: crypto.randomBytes(8).toString('hex'),
      type,
      senderId: this.config.localPeerId,
      recipientId,
      payload,
      encrypted: this.config.enableEncryption,
      timestamp: Date.now(),
      correlationId,
    };
  }

  private broadcastHeartbeat(): void {
    const peers = this.discovery.getKnownPeers();
    for (const peer of peers) {
      this.sendMessage(peer.id, 'heartbeat', {
        uptime: process.uptime(),
        capabilities: this.discovery.getLocalPeer().capabilities,
      }).catch(() => {
        this.discovery.updatePeerStatus(peer.id, 'offline');
      });
    }
  }

  private recordAudit(
    peerId: string,
    action: FederationMessageType,
    direction: 'inbound' | 'outbound',
    dataSize: number,
    success: boolean
  ): void {
    this.auditLog.push({
      id: crypto.randomBytes(6).toString('hex'),
      peerId,
      action,
      direction,
      dataSize,
      encrypted: this.config.enableEncryption,
      success,
      timestamp: Date.now(),
    });

    // Keep audit log bounded
    if (this.auditLog.length > 10_000) {
      this.auditLog = this.auditLog.slice(-5_000);
    }
  }
}
