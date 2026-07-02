import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { LLMRequest, LLMResponse } from '@aios/types';

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
}

interface CacheEntry {
  response: LLMResponse;
  timestamp: number;
  size: number;
}

export class LLMCache {
  private cacheFilePath: string;
  private cacheData: Map<string, CacheEntry> = new Map();
  private readonly MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  public stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0
  };

  constructor() {
    let userDataPath: string;
    try {
      const { app } = require('electron');
      userDataPath = app.getPath('userData');
    } catch {
      userDataPath = path.join(os.homedir(), '.aios');
    }

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.cacheFilePath = path.join(userDataPath, 'llm_cache.json');
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
        // Parse array of [key, value] to preserve map
        if (Array.isArray(raw)) {
          for (const [key, entry] of raw) {
            this.cacheData.set(key, entry);
            this.stats.memoryUsage += entry.size;
          }
        } else {
          // Legacy migration
          for (const [key, response] of Object.entries(raw)) {
            const size = Buffer.byteLength(JSON.stringify(response));
            this.cacheData.set(key, { response: response as LLMResponse, timestamp: Date.now(), size });
            this.stats.memoryUsage += size;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private saveCache(): void {
    try {
      // Save as array of entries to preserve LRU order
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(Array.from(this.cacheData.entries())), 'utf8');
    } catch {
      // ignore
    }
  }

  private generateKey(request: LLMRequest): string {
    const data = JSON.stringify({
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      model: request.model,
      temperature: request.temperature,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private evictIfNeeded(): void {
    // 1. Evict expired TTLs
    const now = Date.now();
    for (const [key, entry] of this.cacheData.entries()) {
      if (now - entry.timestamp > this.TTL_MS) {
        this.stats.memoryUsage -= entry.size;
        this.cacheData.delete(key);
        this.stats.evictions++;
      }
    }

    // 2. LRU Eviction if still over size
    // Maps iterate in insertion order, so the first items are the least recently used
    while (this.stats.memoryUsage > this.MAX_SIZE_BYTES && this.cacheData.size > 0) {
      const oldestKey = this.cacheData.keys().next().value;
      if (oldestKey) {
        const entry = this.cacheData.get(oldestKey);
        if (entry) {
          this.stats.memoryUsage -= entry.size;
          this.cacheData.delete(oldestKey);
          this.stats.evictions++;
        }
      }
    }
  }

  public get(request: LLMRequest): LLMResponse | null {
    if (request.temperature && request.temperature > 0.5) return null; // Only cache deterministic/low-temp queries
    
    const key = this.generateKey(request);
    const entry = this.cacheData.get(key);
    
    if (entry) {
      // Check TTL
      if (Date.now() - entry.timestamp > this.TTL_MS) {
        this.stats.memoryUsage -= entry.size;
        this.cacheData.delete(key);
        this.stats.evictions++;
        this.stats.misses++;
        return null;
      }
      
      // Update LRU position
      this.cacheData.delete(key);
      this.cacheData.set(key, entry);
      this.stats.hits++;
      return entry.response;
    }
    
    this.stats.misses++;
    return null;
  }

  public set(request: LLMRequest, response: LLMResponse): void {
    if (request.temperature && request.temperature > 0.5) return;
    
    const key = this.generateKey(request);
    
    // Remove old entry if it exists
    const existing = this.cacheData.get(key);
    if (existing) {
      this.stats.memoryUsage -= existing.size;
      this.cacheData.delete(key);
    }
    
    const size = Buffer.byteLength(JSON.stringify(response));
    this.cacheData.set(key, { response, timestamp: Date.now(), size });
    this.stats.memoryUsage += size;
    
    this.evictIfNeeded();
    this.saveCache();
  }

  public clear(): void {
    this.cacheData.clear();
    this.stats.memoryUsage = 0;
    this.saveCache();
  }
}
