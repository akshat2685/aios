import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { AgentTool } from '@aios/types';
import { WorkspaceService } from '@aios/devtools';
import { CoreLogger } from '@aios/core';

// Helper to assert paths remain inside workspace boundaries
function checkPathSafety(filePath: string, workspacePath: string): string {
  const resolvedWorkspace = path.resolve(workspacePath);
  // If absolute, resolve directly; if relative, resolve from workspace root
  const resolvedTarget = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(resolvedWorkspace, filePath);

  if (!resolvedTarget.startsWith(resolvedWorkspace)) {
    throw new Error(`Access Denied: Path ${filePath} is outside the allowed workspace boundary: ${resolvedWorkspace}`);
  }
  return resolvedTarget;
}

export function getCodingTools(
  workspacePath: string, 
  logger: CoreLogger, 
  requestApproval?: (action: string, details: string) => Promise<boolean>
): AgentTool[] {
  const workspaceService = new WorkspaceService(logger);

  return [
    {
      name: 'file:read',
      description: 'Reads the complete plain text content of a file within the workspace.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path of the file to read' }
        },
        required: ['filePath']
      },
      async execute({ filePath }) {
        const safePath = checkPathSafety(filePath, workspacePath);
        if (!fs.existsSync(safePath)) {
          return `Error: File does not exist at ${filePath}`;
        }
        return await fs.readFile(safePath, 'utf8');
      }
    },
    {
      name: 'file:write',
      description: 'Creates a new file or overwrites an existing file with the specified content.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path of the file to write' },
          content: { type: 'string', description: 'Plain text content to write to the file' }
        },
        required: ['filePath', 'content']
      },
      async execute({ filePath, content }) {
        const safePath = checkPathSafety(filePath, workspacePath);
        await fs.ensureDir(path.dirname(safePath));
        await fs.writeFile(safePath, content, 'utf8');
        return `Successfully wrote file to ${filePath}`;
      }
    },
    {
      name: 'file:edit',
      description: 'Performs a search-and-replace edit on an existing file. The target content must match exactly.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Relative path of the file to edit' },
          search: { type: 'string', description: 'Exact string block to search for and replace' },
          replace: { type: 'string', description: 'Replacement string block' }
        },
        required: ['filePath', 'search', 'replace']
      },
      async execute({ filePath, search, replace }) {
        const safePath = checkPathSafety(filePath, workspacePath);
        if (!fs.existsSync(safePath)) {
          return `Error: File does not exist at ${filePath}`;
        }

        const original = await fs.readFile(safePath, 'utf8');
        if (!original.includes(search)) {
          return `Error: Target search block not found in file ${filePath}. Be sure to provide the exact string block matching all whitespace and indents.`;
        }

        const updated = original.replace(search, replace);
        await fs.writeFile(safePath, updated, 'utf8');
        return `Successfully edited file ${filePath}`;
      }
    },
    {
      name: 'dir:list',
      description: 'Lists the contents of a directory (defaulting to workspace root) recursively or non-recursively.',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Subdirectory path to list (optional)' },
          recursive: { type: 'boolean', description: 'If true, returns recursive file tree (optional)' }
        }
      },
      async execute({ dirPath = '.', recursive = false }) {
        const safePath = checkPathSafety(dirPath, workspacePath);
        if (recursive) {
          const tree = await workspaceService.getFileTree(safePath, 5);
          return JSON.stringify(tree, null, 2);
        } else {
          const files = await fs.readdir(safePath);
          const statsList = [];
          for (const file of files) {
            if (['.git', 'node_modules', 'dist', 'build'].includes(file)) continue;
            const full = path.join(safePath, file);
            const stats = await fs.stat(full);
            statsList.push({
              name: file,
              isDirectory: stats.isDirectory(),
              size: stats.size,
              updatedAt: stats.mtimeMs,
            });
          }
          return JSON.stringify(statsList, null, 2);
        }
      }
    },
    {
      name: 'workspace:grep',
      description: 'Performs a case-insensitive search for string query patterns across all workspace files.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Pattern or keyword to search for' }
        },
        required: ['query']
      },
      async execute({ query }) {
        const foundFiles = await workspaceService.findFiles(workspacePath, query);
        const matches: Array<{ file: string, line: number, text: string }> = [];
        
        const scan = async (dir: string) => {
          const list = await fs.readdir(dir);
          for (const item of list) {
            if (['.git', 'node_modules', 'dist', 'build'].includes(item)) continue;
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
              await scan(fullPath);
            } else {
              const ext = path.extname(item).toLowerCase();
              if (['.txt', '.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.py'].includes(ext)) {
                const text = await fs.readFile(fullPath, 'utf8');
                const lines = text.split('\n');
                lines.forEach((line, idx) => {
                  if (line.toLowerCase().includes(query.toLowerCase())) {
                    matches.push({
                      file: path.relative(workspacePath, fullPath).replace(/\\/g, '/'),
                      line: idx + 1,
                      text: line.trim()
                    });
                  }
                });
              }
            }
          }
        };

        try {
          await scan(workspacePath);
        } catch (e) {
          // ignore scan errors
        }

        return JSON.stringify({
          matchedFiles: foundFiles.slice(0, 10),
          lineMatches: matches.slice(0, 30)
        }, null, 2);
      }
    },
    {
      name: 'shell:run',
      description: 'Executes a terminal CLI command inside the active workspace directory.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command line to execute' }
        },
        required: ['command']
      },
      async execute({ command }) {
        if (requestApproval) {
          const approved = await requestApproval('shell:run', command);
          if (!approved) {
            return `Error: Permission Denied. User rejected shell execution command: "${command}"`;
          }
        }

        return new Promise((resolve) => {
          logger.info(`Running shell command inside workspace: ${command}`);
          exec(command, { cwd: workspacePath }, (error, stdout, stderr) => {
            const output = [
              stdout ? `STDOUT:\n${stdout}` : '',
              stderr ? `STDERR:\n${stderr}` : '',
              error ? `EXECUTION ERROR:\n${error.message}` : ''
            ].filter(Boolean).join('\n\n');
            
            resolve(output || 'Command executed successfully with no output.');
          });
        });
      }
    }
  ];
}
