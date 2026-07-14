import { describe, it, expect, vi } from 'vitest';
import { getDbTools } from '../db-tools';

describe('DB Tools', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any;

  it('should generate migration for adding a column', async () => {
    const tools = getDbTools(mockLogger);
    const genTool = tools.find(t => t.name === 'db:generate_migration');
    
    const resPg = await genTool!.execute({ dialect: 'postgres', changeDescription: 'add column email to users' });
    expect(resPg).toContain('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
    expect(resPg).toContain('ALTER TABLE users DROP COLUMN email');
  });

  it('should generate migration for creating a table', async () => {
    const tools = getDbTools(mockLogger);
    const genTool = tools.find(t => t.name === 'db:generate_migration');
    
    const resMysql = await genTool!.execute({ dialect: 'mysql', changeDescription: 'create table users' });
    expect(resMysql).toContain('CREATE TABLE users');
    expect(resMysql).toContain('INT AUTO_INCREMENT');
  });

  it('should analyze schema diff', async () => {
    const tools = getDbTools(mockLogger);
    const diffTool = tools.find(t => t.name === 'db:analyze_schema_diff');
    
    const res1 = await diffTool!.execute({ oldSchema: 'VARCHAR', newSchema: 'INTEGER email' });
    expect(res1).toContain('Type change from VARCHAR to INTEGER');
    expect(res1).toContain('New column "email" added');

    const res2 = await diffTool!.execute({ oldSchema: 'CREATE TABLE a (id INT);', newSchema: 'id' });
    expect(res2).toContain('Schema size decreased');
  });

  it('should validate query performance', async () => {
    const tools = getDbTools(mockLogger);
    const valTool = tools.find(t => t.name === 'db:validate_query_performance');
    
    const res = await valTool!.execute({ query: "SELECT * FROM users WHERE name LIKE '%john' ORDER BY id", dialect: 'postgres' });
    expect(res).toContain('Avoid SELECT *');
    expect(res).toContain('Leading wildcard in LIKE clause');
    expect(res).toContain('Ensure columns in ORDER BY are indexed');
    
    const resBad2 = await valTool!.execute({ query: 'SELECT id FROM users', dialect: 'mysql' });
    expect(resBad2).toContain('Missing WHERE clause');
  });
});
