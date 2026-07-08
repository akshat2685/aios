import { CoreLogger } from '@aios/core';
import { PeerNode, PeerCapability, PeerStatus } from '@aios/types';
import * as crypto from 'crypto';

/**
 * PeerDiscovery — Peer registration and discovery for the AIOS
 * Federated Multi-Agent Network.
 *
 * Handles local peer identity generation, mDNS-based LAN discovery,
 * manual peer registration via invite codes, and capability advertisement.
 */
export class PeerDiscovery {
  private logger: CoreLogger;
  private localPeer: PeerNode;
  private knownPeers: Map<string, PeerNode> = new Map();
  private discoveryActive: boolean = false;

  constructor(
    logger: CoreLogger,
    options: {
      displayName?: string;
      port?: number;
      capabilities?: PeerCapability[];
    } = {}
  ) {
    this.logger = logger;

    // Generate local peer identity
    const { publicKey, privateKey } = this.generateKeyPair();
    const peerId = crypto.createHash('sha256').update(publicKey).digest('hex').substring(0, 16);

    this.localPeer = {
      id: peerId,
      displayName: options.displayName || `AIOS-${peerId.substring(0, 6)}`,
      publicKey,
      address: '127.0.0.1',
      port: options.port || 9470,
      status: 'online',
      capabilities: options.capabilities || [],
      lastSeen: Date.now(),
      latencyMs: 0,
    };

    this.logger.info(`PeerDiscovery initialized: ${this.localPeer.displayName} (${this.localPeer.id})`);
  }

  /**
   * Get the local peer node identity.
   */
  public getLocalPeer(): PeerNode {
    return { ...this.localPeer };
  }

  /**
   * Start mDNS-based discovery on the local network.
   */
  public async startDiscovery(): Promise<void> {
    if (this.discoveryActive) return;
    this.discoveryActive = true;

    this.logger.info('Starting mDNS peer discovery on local network...');

    // Stub: In production, this would:
    // 1. Advertise our peer on mDNS with service type '_aios._tcp'
    // 2. Listen for other AIOS instances broadcasting on the same service type
    // 3. Exchange public keys and capability manifests
    // 4. Add discovered peers to knownPeers map

    this.logger.info('mDNS discovery active');
  }

  /**
   * Stop mDNS discovery.
   */
  public async stopDiscovery(): Promise<void> {
    this.discoveryActive = false;
    this.logger.info('mDNS peer discovery stopped');
  }

  /**
   * Manually register a peer via direct address.
   */
  public async registerPeer(address: string, port: number): Promise<PeerNode | null> {
    this.logger.info(`Attempting to register peer at ${address}:${port}`);

    // Stub: In production, this would:
    // 1. Connect to the remote peer's WebSocket server
    // 2. Exchange identity handshake (public keys, capabilities)
    // 3. Verify peer identity via challenge-response
    // 4. Add to known peers if successful

    const peerId = crypto.randomBytes(8).toString('hex');
    const peer: PeerNode = {
      id: peerId,
      displayName: `Peer-${peerId.substring(0, 6)}`,
      publicKey: '',
      address,
      port,
      status: 'online',
      capabilities: [],
      lastSeen: Date.now(),
      latencyMs: 0,
    };

    this.knownPeers.set(peerId, peer);
    this.logger.info(`Registered peer: ${peer.displayName} at ${address}:${port}`);
    return peer;
  }

  /**
   * Generate an invite code for manual peer registration.
   * The invite code encodes the local peer's address, port, and public key.
   */
  public generateInviteCode(): string {
    const payload = JSON.stringify({
      id: this.localPeer.id,
      address: this.localPeer.address,
      port: this.localPeer.port,
      publicKey: this.localPeer.publicKey,
      displayName: this.localPeer.displayName,
    });

    // Base64 encode for easy sharing
    const code = Buffer.from(payload).toString('base64');
    this.logger.debug('Generated invite code');
    return code;
  }

  /**
   * Register a peer from an invite code.
   */
  public async registerFromInviteCode(inviteCode: string): Promise<PeerNode | null> {
    try {
      const payload = JSON.parse(Buffer.from(inviteCode, 'base64').toString('utf-8'));
      this.logger.info(`Registering peer from invite code: ${payload.displayName}`);

      const peer: PeerNode = {
        id: payload.id,
        displayName: payload.displayName,
        publicKey: payload.publicKey,
        address: payload.address,
        port: payload.port,
        status: 'offline', // Will update on first heartbeat
        capabilities: [],
        lastSeen: 0,
        latencyMs: 0,
      };

      this.knownPeers.set(peer.id, peer);
      return peer;
    } catch (error: any) {
      this.logger.error(`Failed to parse invite code: ${error.message}`);
      return null;
    }
  }

  /**
   * Update the local peer's advertised capabilities.
   */
  public updateCapabilities(capabilities: PeerCapability[]): void {
    this.localPeer.capabilities = capabilities;
    this.logger.debug(`Updated capabilities: ${capabilities.length} items`);
  }

  /**
   * Get all known peers.
   */
  public getKnownPeers(): PeerNode[] {
    return Array.from(this.knownPeers.values());
  }

  /**
   * Get a specific peer by ID.
   */
  public getPeer(peerId: string): PeerNode | undefined {
    return this.knownPeers.get(peerId);
  }

  /**
   * Update a peer's status.
   */
  public updatePeerStatus(peerId: string, status: PeerStatus, latencyMs?: number): void {
    const peer = this.knownPeers.get(peerId);
    if (peer) {
      peer.status = status;
      peer.lastSeen = Date.now();
      if (latencyMs !== undefined) peer.latencyMs = latencyMs;
    }
  }

  /**
   * Remove a peer from the known peers list.
   */
  public removePeer(peerId: string): void {
    this.knownPeers.delete(peerId);
    this.logger.info(`Removed peer: ${peerId}`);
  }

  /**
   * Check if discovery is currently active.
   */
  public isDiscoveryActive(): boolean {
    return this.discoveryActive;
  }

  // ─── Private ───────────────────────────────────────────────

  private generateKeyPair(): { publicKey: string; privateKey: string } {
    // Stub: In production, use Ed25519 keypair generation
    // crypto.generateKeyPairSync('ed25519')
    return {
      publicKey: crypto.randomBytes(32).toString('hex'),
      privateKey: crypto.randomBytes(32).toString('hex'),
    };
  }
}
