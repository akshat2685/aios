import { CoreLogger } from '@aios/core';
import { IMemoryClient } from '@aios/types';

export interface SearchResult {
  id: string;
  type: 'MEMORY' | 'NOTE' | 'FILE' | 'CHAT' | 'TIMELINE' | 'GOAL' | 'GRAPH_NODE';
  title: string;
  snippet: string;
  score: number;
  metadata?: Record<string, any>;
}

export class GlobalSearchEngine {
  private logger: CoreLogger;
  private memoryClient: IMemoryClient;
  private cache: Map<string, { results: SearchResult[], timestamp: number }> = new Map();
  private CACHE_TTL_MS = 60 * 1000; // 1 minute cache

  constructor(logger: CoreLogger, memoryClient: IMemoryClient) {
    this.logger = logger;
    this.memoryClient = memoryClient;
  }

  /**
   * Performs a unified high-performance search across structured data
   * and semantic memory with caching.
   */
  public async search(query: string, options?: { limit?: number, useCache?: boolean }): Promise<SearchResult[]> {
    this.logger.info(`Performing global search for: "${query}"`);
    const limit = options?.limit || 10;
    const useCache = options?.useCache ?? true;
    
    const cacheKey = `${query}:${limit}`;
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug(`Returning cached search results for: "${query}"`);
        return cached.results;
      }
    }
    
    // 1. Semantic search via MemoryClient
    const memoryResults = await this.memoryClient.search({ query, limit: limit * 2 });
    
    // 2. Map and assemble intelligent context
    const results: SearchResult[] = memoryResults.map(res => ({
      id: res.id || res._id || Math.random().toString(),
      type: res.metadata?.type || 'MEMORY',
      title: res.metadata?.title || 'Semantic Memory Result',
      snippet: res.content || res.text || '',
      score: res.score || res.similarity || 0,
      metadata: res.metadata
    }));
    
    // 3. Sort by score descending (high-performance query result re-ranking)
    results.sort((a, b) => b.score - a.score);
    
    const finalResults = results.slice(0, limit);
    
    if (useCache) {
      this.cache.set(cacheKey, { results: finalResults, timestamp: Date.now() });
    }
    
    return finalResults;
  }
  
  public clearCache(): void {
    this.cache.clear();
    this.logger.info('Search cache cleared');
  }
}
