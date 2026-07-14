import { DocumentPipeline } from './packages/core/src/document-pipeline';
import { IChunker, IDocumentContext, IEmbeddingProvider, IMemoryClient, IPostprocessor, IPreprocessor } from './packages/types/src/ingestion';
import { chunkText } from './packages/memory/src/chunker';
import { performance } from 'perf_hooks';

class MockMemoryClient implements IMemoryClient {
  async init(): Promise<void> {}
  async add(record: any): Promise<void> {}
  async addMany(records: any[]): Promise<void> {}
  async update(recordId: string, updates: any): Promise<void> {}
  async delete(recordId: string): Promise<void> {}
  async deleteByMetadata(key: string, value: any): Promise<void> {}
  async getById(recordId: string): Promise<any> { return null; }
  async search(options: any): Promise<any[]> { return []; }
  async clear(): Promise<void> {}
  async getStats(): Promise<Record<string, any>> { return {}; }
}

class MockPreprocessor implements IPreprocessor {
  name = 'MockPreprocessor';
  async process(context: IDocumentContext): Promise<void> {
    context.normalizedContent = context.rawContent.toLowerCase();
  }
}

class DefaultChunker implements IChunker {
  name = 'DefaultChunker';
  async chunk(context: IDocumentContext): Promise<void> {
    if (!context.normalizedContent) return;
    const chunks = chunkText(context.normalizedContent, { chunkSize: 500, chunkOverlap: 50 });
    context.chunks = chunks.map((c, idx) => ({
      id: `${context.id}-chunk-${idx}`,
      sequence: idx,
      content: c,
      metadata: {}
    }));
  }
}

class MockEmbeddingProvider implements IEmbeddingProvider {
  name = 'MockEmbeddingProvider';
  async embed(context: IDocumentContext): Promise<void> {
    if (!context.chunks) return;
    for (const chunk of context.chunks) {
      // Simulate embedding latency and CPU work
      chunk.vector = new Array(384).fill(Math.random());
    }
  }
}

class MockPostprocessor implements IPostprocessor {
  name = 'MockPostprocessor';
  async process(context: IDocumentContext): Promise<void> {}
}

async function runBenchmark() {
  console.log('Setting up benchmark...');
  const memoryClient = new MockMemoryClient();
  const pipeline = new DocumentPipeline(memoryClient);
  
  pipeline.addPreprocessor(new MockPreprocessor());
  pipeline.setChunker(new DefaultChunker());
  pipeline.setEmbeddingProvider(new MockEmbeddingProvider());
  pipeline.addPostprocessor(new MockPostprocessor());

  const documentSizeInKB = 10;
  const charsPerKB = 1024;
  const sampleText = Array(documentSizeInKB).fill('a'.repeat(charsPerKB)).join('\\n\\n');

  const docCount = 1000;
  console.log(`Starting benchmark for ${docCount} documents of size ${documentSizeInKB}KB...`);

  const startTime = performance.now();
  let completed = 0;

  for (let i = 0; i < docCount; i++) {
    await pipeline.ingest(`source-${i}`, sampleText, { index: i });
    completed++;
    if (completed % 100 === 0) {
      console.log(`Processed ${completed}/${docCount} documents...`);
    }
  }

  const endTime = performance.now();
  const totalMs = endTime - startTime;
  const avgMs = totalMs / docCount;
  const docsPerSecond = (docCount / totalMs) * 1000;
  
  console.log('\\n--- Benchmark Results ---');
  console.log(`Total Time: ${totalMs.toFixed(2)} ms`);
  console.log(`Average Latency: ${avgMs.toFixed(2)} ms / document`);
  console.log(`Throughput: ${docsPerSecond.toFixed(2)} documents / second`);
}

runBenchmark().catch(console.error);
