import { IConnector, IngestionPayload } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { FileSystemConnector } from './fs-connector';

export class ConnectorManager {
  private connectors: Map<string, IConnector> = new Map();
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async registerConnector(connector: IConnector) {
    this.connectors.set(connector.id, connector);
    this.logger.info(`Connector registered: ${connector.name}`);
  }

  async startAll() {
    for (const connector of this.connectors.values()) {
      try {
        await connector.start();
      } catch (e) {
        this.logger.error(`Failed to start connector ${connector.id}: ${e}`);
      }
    }
  }

  async stopAll() {
    for (const connector of this.connectors.values()) {
      await connector.stop();
    }
  }

  getConnectorStatus() {
    const statuses: Record<string, any> = {};
    for (const [id, connector] of this.connectors) {
      statuses[id] = connector.status();
    }
    return statuses;
  }
}