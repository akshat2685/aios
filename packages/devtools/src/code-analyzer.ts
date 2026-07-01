import fs from 'fs-extra';
import path from 'path';
import { CodeAnalysis } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class CodeAnalyzer {
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async analyzeFile(filePath: string): Promise<CodeAnalysis> {
    try {
      this.logger.debug(`Analyzing file: ${filePath}`);
      const content = await fs.readFile(filePath, 'utf8');
      const ext = path.extname(filePath);

      // Basic regex-based analysis as a fallback until tree-sitter bindings are configured
      // Production-grade implementation would use tree-sitter
      const symbols = this.extractSymbols(content, ext);

      return {
        filePath,
        language: this.mapExtensionToLanguage(ext),
        symbols,
        dependencies: this.extractDependencies(content, ext),
      };
    } catch (error: any) {
      this.logger.error(`Code analysis failed for ${filePath}: ${error.message}`);
      throw error;
    }
  }

  private extractSymbols(content: string, ext: string): any[] {
    const symbols = [];
    if (ext === '.ts' || ext === '.js') {
      // Basic function extraction
      const funcRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        symbols.push({
          name: match[1],
          type: 'function',
          line: content.substring(0, match.index).split('\n').length,
          column: match.index - content.lastIndexOf('\n', match.index),
        });
      }

      // Basic class extraction
      const classRegex = /class\s+([a-zA-Z0-9_]+)\s*\{/g;
      while ((match = classRegex.exec(content)) !== null) {
        symbols.push({
          name: match[1],
          type: 'class',
          line: content.substring(0, match.index).split('\n').length,
          column: match.index - content.lastIndexOf('\n', match.index),
        });
      }
    }
    return symbols;
  }

  private extractDependencies(content: string, ext: string): string[] {
    const deps = new Set<string>();
    if (ext === '.ts' || ext === '.js') {
      const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        deps.add(match[1]);
      }
    }
    return Array.from(deps);
  }

  private mapExtensionToLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.json': 'json',
      '.md': 'markdown',
    };
    return map[ext] || 'plaintext';
  }
}