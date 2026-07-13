import { IConnector, IngestionPayload, IDocumentIngester, ConnectorError } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { EventEmitter } from 'events';

interface QueueItem {
  payload: IngestionPayload;
  retries: number;
}

export class ConnectorMediator extends EventEmitter {
  private connectors: Map<string, IConnector> = new Map();
  private logger: CoreLogger;
  private ingester: IDocumentIngester;
  private queue: QueueItem[] = [];
  private isProcessingQueue = false;
  private maxRetries = 3;

  constructor(logger: CoreLogger, ingester: IDocumentIngester) {
    super();
    this.logger = logger;
    this.ingester = ingester;
  }

  async registerConnector(connector: IConnector) {
    this.connectors.set(connector.id, connector);
    this.logger.info(`Connector registered: ${connector.name}`);
  }

  async startAll() {
    for (const connector of this.connectors.values()) {
      try {
        await connector.start(async (payload) => {
          this.enqueue(payload);
        });
        this.emit('connectorStarted', { id: connector.id });
      } catch (e: any) {
        this.logger.error(`Failed to start connector ${connector.id}: ${e.message}`);
        this.emit('connectorError', new ConnectorError(`Failed to start connector ${connector.id}`, e));
      }
    }
  }

  async stopAll() {
    for (const connector of this.connectors.values()) {
      await connector.stop();
      this.emit('connectorStopped', { id: connector.id });
    }
  }

  getConnectorStatus() {
    const statuses: Record<string, any> = {};
    for (const [id, connector] of this.connectors) {
      statuses[id] = connector.status();
    }
    return statuses;
  }

  private enqueue(payload: IngestionPayload) {
    this.queue.push({ payload, retries: 0 });
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        // Authenticate/Validate payload
        this.validatePayload(item.payload);

        // Send to Ingester
        await this.ingester.ingest(item.payload.source, item.payload.content, item.payload.metadata);
      } catch (err: any) {
        this.logger.error(`Failed to ingest payload from ${item.payload.source}: ${err.message}`);
        if (item.retries < this.maxRetries) {
          item.retries++;
          this.logger.info(`Retrying payload from ${item.payload.source} (Attempt ${item.retries}/${this.maxRetries})`);
          this.queue.push(item); // Re-queue at the end
        } else {
          this.emit('ingestionFailed', { payload: item.payload, error: err });
        }
      }
    }

    this.isProcessingQueue = false;
  }

  private validatePayload(payload: IngestionPayload) {
    if (!payload.content || typeof payload.content !== 'string') {
      throw new ConnectorError('Invalid payload content');
    }
    if (Buffer.byteLength(payload.content, 'utf8') > 10 * 1024 * 1024) {
      throw new ConnectorError('Payload exceeds maximum size limit (10MB)');
    }
  }
}