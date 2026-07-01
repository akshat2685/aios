import fs from 'fs-extra';
import path from 'path';
import { CoreLogger } from '@aios/core';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: FileNode[];
}

export class WorkspaceService {
  private logger: CoreLogger;
  private defaultIgnore = new Set(['.git', 'node_modules', 'dist', 'build', '.DS_Store', 'Thumbs.db']);

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  /**
   * Get the recursive file tree of the workspace
   */
  async getFileTree(workspacePath: string, maxDepth = 10): Promise<FileNode> {
    try {
      if (!fs.existsSync(workspacePath)) {
        throw new Error(`Workspace path does not exist: ${workspacePath}`);
      }
      
      const stats = await fs.stat(workspacePath);
      if (!stats.isDirectory()) {
        throw new Error(`Workspace path is not a directory: ${workspacePath}`);
      }

      return await this.scanDir(workspacePath, workspacePath, 0, maxDepth);
    } catch (error: any) {
      this.logger.error(`Failed to generate workspace file tree: ${error.message}`);
      throw error;
    }
  }

  private async scanDir(dirPath: string, rootPath: string, depth: number, maxDepth: number): Promise<FileNode> {
    const name = path.basename(dirPath) || dirPath;
    const relPath = path.relative(rootPath, dirPath);

    const node: FileNode = {
      name,
      path: relPath === '' ? '.' : relPath.replace(/\\/g, '/'),
      isDirectory: true,
      children: [],
    };

    if (depth >= maxDepth) {
      return node;
    }

    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (this.defaultIgnore.has(file)) continue;

        const childPath = path.join(dirPath, file);
        const stats = await fs.stat(childPath);

        if (stats.isDirectory()) {
          const childDirNode = await this.scanDir(childPath, rootPath, depth + 1, maxDepth);
          node.children?.push(childDirNode);
        } else {
          const childRelPath = path.relative(rootPath, childPath).replace(/\\/g, '/');
          node.children?.push({
            name: file,
            path: childRelPath,
            isDirectory: false,
            size: stats.size,
            extension: path.extname(file).toLowerCase(),
          });
        }
      }

      // Sort: Directories first, then alphabetically
      node.children?.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (e: any) {
      this.logger.warn(`Failed to read directory ${dirPath}: ${e.message}`);
    }

    return node;
  }

  /**
   * Search workspace files matching an extension or name pattern
   */
  async findFiles(workspacePath: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    const search = async (dir: string) => {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (this.defaultIgnore.has(file)) continue;
        const childPath = path.join(dir, file);
        const stats = await fs.stat(childPath);

        if (stats.isDirectory()) {
          await search(childPath);
        } else if (file.toLowerCase().includes(pattern.toLowerCase()) || path.extname(file).toLowerCase() === pattern.toLowerCase()) {
          results.push(path.relative(workspacePath, childPath).replace(/\\/g, '/'));
        }
      }
    };
    
    if (fs.existsSync(workspacePath)) {
      await search(workspacePath);
    }
    return results;
  }
}
