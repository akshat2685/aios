import fs from 'fs/promises';
import { CoreLogger } from '@aios/core';

export class FileSystemController {
  private logger: CoreLogger;
  
  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async readFile(filePath: string): Promise<string> {
    this.logger.info(`Reading file: ${filePath}`);
    return fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.logger.info(`Writing to file: ${filePath}`);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async listDir(dirPath: string): Promise<string[]> {
    this.logger.info(`Listing directory: ${dirPath}`);
    return fs.readdir(dirPath);
  }
}
