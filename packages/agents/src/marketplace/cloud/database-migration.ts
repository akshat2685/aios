import { BaseAgent } from '../../base-agent';
import { LLMRouter } from '@aios/llm';
import { CoreLogger } from '@aios/core';
import { getDbTools } from './db-tools';

export class DatabaseMigrationAgent extends BaseAgent {
  constructor(router: LLMRouter, logger: CoreLogger) {
    super('Database Migrator', 'Database Migration Specialist', router, logger);
    
    // Register DB tools
    const tools = getDbTools(logger);
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  protected getSystemPrompt(): string {
    return `You are the AIOS Database Migration Agent. You specialize in database schema migrations, ETL processes, and database versioning.
    You have expertise in both SQL and NoSQL databases (e.g., PostgreSQL, MySQL, MongoDB, Redis).
    You ensure migrations are safe, non-destructive, and can be rolled back.
    You can use tools to generate SQL migration scripts, analyze schema changes, and validate data integrity.`;
  }
}
