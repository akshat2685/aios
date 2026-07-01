import fs from 'fs-extra';
import path from 'path';
import mammoth from 'mammoth';

// pdf-parse require deferred to avoid DOMMatrix error on boot

const PARSEABLE_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml',
  '.pdf', '.docx', '.log', '.ts', '.js', '.py', '.html', '.css'
]);

export interface ParsedDocument {
  content: string;
  metadata: Record<string, any>;
}

export async function parseDocument(filePath: string): Promise<ParsedDocument | null> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (!PARSEABLE_EXTENSIONS.has(ext)) {
    return null; // Skip unsupported binary formats
  }

  try {
    if (ext === '.pdf') {
      const dataBuffer = await fs.readFile(filePath);
      // Ensure we don't crash the main process with polyfills, defer require
      const pdf = require('pdf-parse');
      const parsed = await pdf(dataBuffer);
      return {
        content: parsed.text || '',
        metadata: {
          pages: parsed.numpages || 0,
          author: parsed.info?.Author || 'unknown',
          title: parsed.info?.Title || path.basename(filePath),
        }
      };
    }

    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return {
        content: result.value || '',
        metadata: {
          messages: result.messages?.length || 0,
        }
      };
    }

    // Default: read as text file
    const content = await fs.readFile(filePath, 'utf8');
    return {
      content: content || '',
      metadata: {}
    };
  } catch (error: any) {
    throw new Error(`Failed to parse document ${filePath}: ${error.message}`);
  }
}
