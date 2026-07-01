import simpleGit, { SimpleGit } from 'simple-git';
import { GitAnalysis } from '@aios/types';
import { CoreLogger } from '@aios/core';
import path from 'path';

export class GitService {
  private git: SimpleGit;
  private logger: CoreLogger;
  private rootDir: string;

  constructor(rootDir: string, logger: CoreLogger) {
    this.rootDir = rootDir;
    this.logger = logger;
    this.git = simpleGit(rootDir);
  }

  async analyzeRepository(): Promise<GitAnalysis> {
    try {
      const status = await this.git.status();
      const log = await this.git.log({ maxCount: 1 });
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      
      const lastCommit = log.latest;
      
      return {
        currentBranch: branch,
        lastCommit: lastCommit ? {
          hash: lastCommit.hash,
          message: lastCommit.message,
          author: lastCommit.author_name,
          date: new Date(lastCommit.date).getTime(),
        } : undefined,
        changedFiles: status.files.map((f: any) => f.path),
        diff: await this.git.diff(['HEAD']),
      };
    } catch (error: any) {
      this.logger.error(`Git analysis failed: ${error.message}`);
      throw error;
    }
  }

  async getCommitHistory(limit: number = 10) {
    try {
      return await this.git.log({ maxCount: limit });
    } catch (error: any) {
      this.logger.error(`Failed to get commit history: ${error.message}`);
      return [];
    }
  }

  async getFileHistory(filePath: string) {
    try {
      return await this.git.log({ file: filePath });
    } catch (error: any) {
      this.logger.error(`Failed to get history for ${filePath}: ${error.message}`);
      return [];
    }
  }
}