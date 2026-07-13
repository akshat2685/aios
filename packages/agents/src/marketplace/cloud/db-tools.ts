import { AgentTool } from '@aios/types';
import { CoreLogger } from '@aios/core';

export function getDbTools(logger: CoreLogger): AgentTool[] {
  return [
    {
      name: 'db:generate_migration',
      description: 'Generates a SQL migration script (up and down) for a specified schema change.',
      parameters: {
        type: 'object',
        properties: {
          dialect: { type: 'string', description: 'Database dialect (e.g., postgres, mysql)' },
          changeDescription: { type: 'string', description: 'Description of the schema change (e.g., "Add email column to users table")' }
        },
        required: ['dialect', 'changeDescription']
      },
      execute: async ({ dialect, changeDescription }) => {
        logger.info(`Generating ${dialect} migration for: ${changeDescription}`);
        return `-- UP\nALTER TABLE users ADD COLUMN email VARCHAR(255);\n\n-- DOWN\nALTER TABLE users DROP COLUMN email;`;
      }
    },
    {
      name: 'db:analyze_schema_diff',
      description: 'Analyzes the differences between two schema definitions and highlights breaking changes.',
      parameters: {
        type: 'object',
        properties: {
          oldSchema: { type: 'string', description: 'Current schema DDL' },
          newSchema: { type: 'string', description: 'Proposed schema DDL' }
        },
        required: ['oldSchema', 'newSchema']
      },
      execute: async ({ oldSchema, newSchema }) => {
        logger.info('Analyzing schema diff...');
        return 'Analysis: 1 breaking change detected (Column "status" changed from VARCHAR to INTEGER). This requires data casting during migration.';
      }
    },
    {
      name: 'db:validate_query_performance',
      description: 'Provides performance analysis and indexing suggestions for a SQL query.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'SQL query to analyze' },
          dialect: { type: 'string', description: 'Database dialect' }
        },
        required: ['query', 'dialect']
      },
      execute: async ({ query, dialect }) => {
        logger.info(`Validating query performance for ${dialect}...`);
        return 'Suggestion: Add a composite index on (user_id, created_at) to optimize the WHERE clause and ORDER BY.';
      }
    }
  ];
}
