import chokidar from 'chokidar';
import fs from 'fs-extra';
import path from 'path';
import { IConnector, IngestionPayload } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { parseDocument } from './doc-parser';

export class FileSystemConnector implements IConnector {
  public readonly id = 'fs-connector';
  public readonly name = 'File System Watcher';
  private watcher: chokidar.FSWatcher | null = null;
  private logger: CoreLogger;
  private watchPaths: string[];
  private onIngest: (payload: IngestionPayload) => Promise<void>;

  constructor(config: { watchPaths: string[], onIngest: (payload: IngestionPayload) => Promise<void> }, logger: CoreLogger) {
    this.watchPaths = config.watchPaths;
    this.onIngest = config.onIngest;
    this.logger = logger;
  }

  async start(): Promise<void> {
    this.logger.info(`Starting File System Connector watching: ${this.watchPaths.join(', ')}`);
    
    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
    });

    this.watcher
      .on('add', path => this.handleFileChange('add', path))
      .on('change', path => this.handleFileChange('change', path))
      .on('error', error => this.logger.error(`Watcher error: ${error}`));
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.logger.info('File System Connector stopped');
    }
  }

  status(): 'active' | 'inactive' | 'error' {
    return this.watcher ? 'active' : 'inactive';
  }

  private async handleFileChange(event: 'add' | 'change', filePath: string) {
    try {
      this.logger.debug(`File ${event}: ${filePath}`);
      const parsed = await parseDocument(filePath);
      if (!parsed) {
        this.logger.debug(`Skipping unparseable/binary file: ${filePath}`);
        return;
      }
      
      const payload: IngestionPayload = {
        source: 'file-system',
        content: parsed.content,
        metadata: {
          timestamp: Date.now(),
          type: 'file',
          path: filePath,
          tags: [path.extname(filePath)],
          ...parsed.metadata,
        }
      };

      await this.onIngest(payload);
    } catch (error: any) {
      this.logger.error(`Error processing file ${filePath}: ${error.message}`);
    }
  }
}