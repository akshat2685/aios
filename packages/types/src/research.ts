export interface ResearchSource {
  title: string;
url: string;
content: string;
snippet: string;
timestamp: number;
score: number;
}

export interface ResearchQuery {
  query: string;
  depth: 'shallow' | 'deep' | 'exhaustive';
  maxSources: number;
  includePapers: boolean;
  includeWeb: boolean;
}

export interface ResearchReport {
  topic: string;
  summary: string;
  keyFindings: Array<{
    finding: string;
    sources: ResearchSource[];
  }>;
  contradictions?: Array<{
    point: string;
    evidence: Array<{ source: ResearchSource, claim: string }>;
  }>;
  suggestedFurtherReading: string[];
  metadata: {
    startTime: number;
    endTime: number;
    sourcesAnalyzed: number;
  };
}