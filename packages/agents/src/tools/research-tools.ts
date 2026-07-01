import { AgentTool } from '@aios/types';
import { ResearchService, WebSearchProvider } from '@aios/research';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';

export function getResearchTools(router: LLMRouter, logger: CoreLogger): AgentTool[] {
  const searchProvider = new WebSearchProvider(logger);
  const researchService = new ResearchService(router, logger);

  return [
    {
      name: 'web:search',
      description: 'Searches DuckDuckGo for top pages matching a query. Returns site titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords or question query' },
          maxResults: { type: 'number', description: 'Number of results to retrieve (optional, default 5)' }
        },
        required: ['query']
      },
      async execute({ query, maxResults = 5 }) {
        const results = await searchProvider.search(query, maxResults);
        if (results.length === 0) return 'No results found.';
        return JSON.stringify(results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet
        })), null, 2);
      }
    },
    {
      name: 'web:scrape',
      description: 'Scrapes a URL and extracts clean article text, removing headers, scripts, sidebars, and ads.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Target website URL' }
        },
        required: ['url']
      },
      async execute({ url }) {
        const result = await searchProvider.fetchAndClean(url);
        return `Title: ${result.title}\n\nContent:\n${result.content}`;
      }
    },
    {
      name: 'research:compile',
      description: 'Conducts a full automated research workflow (search, scrape top sources, run LLM synthesis, and parse markdown reports).',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Core research topic or question to compile a report on' },
          maxSources: { type: 'number', description: 'Maximum sources to analyze (optional, default 5)' }
        },
        required: ['topic']
      },
      async execute({ topic, maxSources = 5 }) {
        const report = await researchService.conductResearch({
          query: topic,
          maxSources,
          depth: 'shallow',
          includePapers: false,
          includeWeb: true
        });
        return JSON.stringify(report, null, 2);
      }
    }
  ];
}
