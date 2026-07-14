import { IMemoryClient } from '@aios/types';
import { v4 as uuidv4 } from 'uuid';
import { chunkText, ChunkingOptions } from './chunker';

export interface DocumentMetadata {
  source: string;
  author?: string;
  title?: string;
  createdAt?: number;
  [key: string]: any;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: DocumentMetadata;
}

/**
 * Document Retrieval system for AIOS.
 * Provides indexing of large documents through chunking and retrieval using hybrid search.
 */
export class DocumentRetrieval {
  constructor(private memoryClient: IMemoryClient) {}

  /**
   * Ingests a document by chunking it and storing the chunks in memory.
   */
  async ingestDocument(
    content: string,
    metadata: DocumentMetadata,
    options?: ChunkingOptions
  ): Promise<string[]> {
    const chunks = chunkText(content, options);
    const documentId = uuidv4();
    const timestamp = Date.now();

    const records = chunks.map((chunk, index) => ({
      id: uuidv4(),
      type: 'document_chunk',
      content: chunk,
      metadata: {
        ...metadata,
        documentId,
        chunkIndex: index,
        totalChunks: chunks.length,
        timestamp
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    if (this.memoryClient.addMany) {
      await this.memoryClient.addMany(records);
    } else {
      for (const record of records) {
        await this.memoryClient.add(record);
      }
    }

    return records.map(r => r.id);
  }

  /**
   * Retrieves relevant document chunks based on a query using hybrid search.
   */
  async retrieve(query: string, limit: number = 5, filter?: Record<string, any>): Promise<DocumentChunk[]> {
    const baseFilter = {
      must: [
        { key: 'type', match: { value: 'document_chunk' } }
      ]
    };

    let finalFilter = baseFilter as any;
    if (filter) {
      finalFilter.must.push(...(Array.isArray(filter) ? filter : [filter]));
    }

    const records = await this.memoryClient.search({
      query,
      filter: finalFilter,
      limit,
      hybrid: true
    });

    return records.map((r: any) => ({
      id: r.id,
      documentId: r.metadata?.documentId,
      content: r.content,
      metadata: r.metadata
    }));
  }
}
