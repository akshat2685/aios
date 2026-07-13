export interface MarketplaceAgentManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entryPoint: string;
  author?: string;
  tags?: string[];
  dependencies?: Record<string, string>;
}

export interface InstallOptions {
  force?: boolean;
}

export interface SearchFilters {
  query?: string;
  tags?: string[];
  author?: string;
}
