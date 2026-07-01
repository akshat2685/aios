import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { WebSearchProvider } from './web-search';
import { ResearchQuery, ResearchReport, ResearchSource } from '@aios/types';
import { ConfigManager } from '@aios/config';

export class ResearchService {
  private router: LLMRouter;
  private logger: CoreLogger;
  private searchProvider: WebSearchProvider;

  constructor(router: LLMRouter, logger: CoreLogger) {
    this.router = router;
    this.logger = logger;
    this.searchProvider = new WebSearchProvider(logger);
  }

  async conductResearch(query: ResearchQuery): Promise<ResearchReport> {
    this.logger.info(`Starting research on: ${query.query}`);
    const startTime = Date.now();

    try {
      // 1. Search for sources
      const maxSources = query.maxSources || 5;
      const sources = await this.searchProvider.search(query.query, maxSources);
      
      // 2. Fetch and analyze content
      const analyzedSources: ResearchSource[] = [];
      for (const source of sources) {
        try {
          const { title, content } = await this.searchProvider.fetchAndClean(source.url);
          analyzedSources.push({
            ...source,
            title,
            content,
            snippet: content.substring(0, 500),
            timestamp: Date.now(),
            score: source.score || 1.0,
          });
        } catch (e: any) {
          this.logger.warn(`Failed to analyze source ${source.url}: ${e.message}`);
        }
      }

      if (analyzedSources.length === 0) {
        return {
          topic: query.query,
          summary: "No sources could be fetched or analyzed for this research topic.",
          keyFindings: [],
          suggestedFurtherReading: [],
          metadata: {
            startTime,
            endTime: Date.now(),
            sourcesAnalyzed: 0,
          }
        };
      }

      // Resolve model overrides
      const overrides = ConfigManager.get('agents.modelOverrides') || {};
      const model = overrides.researcher?.model || 'qwen2.5';

      // 3. Synthesize report using LLM
      const synthesisPrompt = this.constructSynthesisPrompt(query.query, analyzedSources);
      const reportData = await this.router.generate({
        prompt: synthesisPrompt,
        model: model,
        systemPrompt: `You are a professional research analyst. Synthesize the provided sources into a structured markdown report. 
Your report MUST include two specific headings at the end:
### Key Findings
- List 3 to 5 core findings as bullet points.

### Further Reading
- List 2 to 3 URLs or source titles for further reading.`,
      });

      // 4. Parse LLM response for key findings and further reading
      const keyFindings: string[] = [];
      const furtherReading: string[] = [];

      const findingsMatch = /### Key Findings([\s\S]*?)(###|$)/i.exec(reportData.content);
      if (findingsMatch) {
        findingsMatch[1].split('\n').forEach(line => {
          const clean = line.replace(/^[\s*-•\d+.]+\s*/, '').trim();
          if (clean.length > 10) keyFindings.push(clean);
        });
      }

      const readingMatch = /### Further Reading([\s\S]*?)(###|$)/i.exec(reportData.content);
      if (readingMatch) {
        readingMatch[1].split('\n').forEach(line => {
          const clean = line.replace(/^[\s*-•\d+.]+\s*/, '').trim();
          if (clean.length > 5) furtherReading.push(clean);
        });
      }

      return {
        topic: query.query,
        summary: reportData.content,
        keyFindings: keyFindings.map(f => ({
          finding: f,
          sources: analyzedSources
        })),
        suggestedFurtherReading: furtherReading,
        metadata: {
          startTime,
          endTime: Date.now(),
          sourcesAnalyzed: analyzedSources.length,
        },
      };
    } catch (error: any) {
      this.logger.error(`Research failed: ${error.message}`);
      throw error;
    }
  }

  private constructSynthesisPrompt(query: string, sources: ResearchSource[]): string {
    const sourcesText = sources.map((s, i) => `[Source ${i+1}] ${s.title} (${s.url})\nContent: ${s.content}\n`).join('\n---\n');
    return `Research Topic: ${query}\n\nAnalyzed Sources:\n${sourcesText}\n\nPlease provide a detailed synthesis of these sources.`;
  }
}