import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDatabase(dbPath?: string) {
  if (dbInstance) return dbInstance;

  const resolvedPath = dbPath || path.join(os.userInfo().homedir, '.aios', 'knowledge_graph.db');
  
  // Ensure the directory exists
  const dbDir = path.dirname(resolvedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const client = createClient({
    url: `file:${resolvedPath}`,
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export { schema };
