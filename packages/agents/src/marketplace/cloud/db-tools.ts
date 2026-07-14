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
        const addColMatch = changeDescription.match(/add\s+(?:column\s+)?(\w+)\s+(?:column\s+)?to\s+(\w+)/i) || changeDescription.match(/add\s+(\w+)\s+to\s+(\w+)/i);
        if (addColMatch) {
          const colType = dialect === 'postgres' ? 'VARCHAR(255)' : 'VARCHAR(255)';
          return `-- UP\nALTER TABLE ${addColMatch[2]} ADD COLUMN ${addColMatch[1]} ${colType};\n\n-- DOWN\nALTER TABLE ${addColMatch[2]} DROP COLUMN ${addColMatch[1]};`;
        }
        const createTableMatch = changeDescription.match(/create\s+(?:table\s+)?(\w+)(?:\s+table)?/i);
        if (createTableMatch && changeDescription.toLowerCase().includes('create')) {
          const idType = dialect === 'postgres' ? 'SERIAL' : 'INT AUTO_INCREMENT';
          return `-- UP\nCREATE TABLE ${createTableMatch[1]} (\n  id ${idType} PRIMARY KEY,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\n-- DOWN\nDROP TABLE ${createTableMatch[1]};`;
        }
        return `-- UP\n-- TODO: Write UP migration for: ${changeDescription}\n\n-- DOWN\n-- TODO: Write DOWN migration for: ${changeDescription}`;
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
        const issues: string[] = [];
        if (oldSchema.length > newSchema.length) {
          issues.push('- Schema size decreased. Potential dropped tables or columns.');
        }
        if (oldSchema.includes('VARCHAR') && newSchema.includes('INTEGER')) {
          issues.push('- Breaking change detected: Type change from VARCHAR to INTEGER. This requires data casting during migration.');
        }
        if (!oldSchema.includes('email') && newSchema.includes('email')) {
          issues.push('- New column "email" added.');
        }
        return issues.length > 0 ? 'Analysis:\n' + issues.join('\n') : 'Analysis: No breaking changes detected.';
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
        const lowerQuery = query.toLowerCase();
        const suggestions: string[] = [];
        if (lowerQuery.includes('select *')) {
          suggestions.push('- Avoid SELECT *. Specify explicit column names to reduce I/O.');
        }
        if (!lowerQuery.includes('where') && lowerQuery.includes('select')) {
          suggestions.push('- Missing WHERE clause. Query will perform a full table scan.');
        }
        if (lowerQuery.includes('like \'%')) {
          suggestions.push('- Leading wildcard in LIKE clause prevents index usage.');
        }
        if (lowerQuery.includes('order by')) {
          suggestions.push('- Ensure columns in ORDER BY are indexed for faster sorting.');
        }
        return suggestions.length > 0 ? 'Performance Suggestions:\n' + suggestions.join('\n') : 'Query looks optimized. No obvious performance issues found.';
      }
    }
  ];
}
