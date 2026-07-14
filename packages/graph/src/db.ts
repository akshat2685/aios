import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDatabase(dbUrl?: string) {
  if (dbInstance) return dbInstance;

  const url = dbUrl || process.env.DATABASE_URL || 'postgresql://aios:aios@localhost:5432/aios_db';
  
  const client = postgres(url, { max: 1 });
  dbInstance = drizzle(client, { schema });
  
  return dbInstance;
}

export { schema };
