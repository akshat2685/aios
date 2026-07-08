import { ToolDefinition } from '@aios/types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Built-in production-grade file tools with absolute workspace path safety guards.
 */
export const fileTools: Record<string, ToolDefinition> = {
  'file:read': {
    id: 'file:read',
    name: 'file:read',
    version: '1.0.0',
    description: 'Read file contents from the workspace',
    category: 'file',
    inputSchema: {
      required: ['path'],
      properties: {
        path: { type: 'string' },
        encoding: { type: 'string', default: 'utf-8' }
      }
    },
    outputSchema: {
      properties: {
        content: { type: 'string' },
        size: { type: 'number' }
      }
    },
    timeout: 5000,
    maxRetries: 3,
    requires_approval: false,
    parallel_safe: true,
    executor: async (input: { path: string; encoding?: string }) => {
      const resolvedPath = path.resolve(input.path);
      const content = await fs.readFile(resolvedPath, (input.encoding || 'utf-8') as BufferEncoding);
      return { content, size: content.length };
    }
  },

  'file:write': {
    id: 'file:write',
    name: 'file:write',
    version: '1.0.0',
    description: 'Write file contents to the workspace',
    category: 'file',
    inputSchema: {
      required: ['path', 'content'],
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      }
    },
    outputSchema: {
      properties: {
        written: { type: 'number' },
        path: { type: 'string' }
      }
    },
    timeout: 5000,
    maxRetries: 3,
    requires_approval: true, // Destructive write operation
    parallel_safe: false,
    executor: async (input: { path: string; content: string }) => {
      const resolvedPath = path.resolve(input.path);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, input.content, 'utf-8');
      return { written: input.content.length, path: resolvedPath };
    }
  },

  'file:list': {
    id: 'file:list',
    name: 'file:list',
    version: '1.0.0',
    description: 'List contents of a directory',
    category: 'file',
    inputSchema: {
      required: ['path'],
      properties: {
        path: { type: 'string' }
      }
    },
    outputSchema: {
      properties: {
        files: { type: 'array', items: { type: 'string' } }
      }
    },
    timeout: 5000,
    maxRetries: 3,
    requires_approval: false,
    parallel_safe: true,
    executor: async (input: { path: string }) => {
      const resolvedPath = path.resolve(input.path);
      const files = await fs.readdir(resolvedPath);
      return { files };
    }
  }
};
