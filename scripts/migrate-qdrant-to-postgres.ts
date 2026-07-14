import { getDatabase, schema } from '../packages/graph/src/db';
// Replace with the actual memory client import from your workspace
import { MemoryClient } from '../packages/storage/src/memory-client'; 
import { eq } from 'drizzle-orm';

async function migrate() {
  console.log('Starting migration from Qdrant to Postgres...');
  const db = getDatabase();
  
  // Initialize Qdrant Client (you might need to adjust connection params)
  const memoryClient = new MemoryClient();
  await memoryClient.init();

  // Migrate Workflows
  console.log('Migrating workflows...');
  // Note: Adjust the exact Qdrant payload/search syntax according to your MemoryClient implementation
  const workflows = await memoryClient.search({ filter: { must: [{ key: 'type', match: { value: 'workflow' } }] }, limit: 10000 });
  
  for (const hit of workflows) {
    const wf = hit.payload.metadata.workflow;
    try {
      await db.insert(schema.workflows).values({
        id: wf.id,
        tenantId: 'default', // Using 'default' as a fallback tenant
        name: wf.name,
        description: wf.description || '',
        isActive: wf.isActive,
        trigger: wf.trigger,
        steps: wf.steps,
        uiData: wf.uiData || null,
      }).onConflictDoNothing();
      console.log(`Migrated workflow: ${wf.id}`);
    } catch (e) {
      console.error(`Failed to migrate workflow ${wf.id}`, e);
    }
  }

  // Migrate Checkpoints
  console.log('Migrating checkpoints...');
  const checkpoints = await memoryClient.search({ filter: { must: [{ key: 'type', match: { value: 'checkpoint' } }] }, limit: 10000 });
  
  for (const hit of checkpoints) {
    const cp = hit.payload.metadata.checkpoint;
    try {
      await db.insert(schema.workflowCheckpoints).values({
        executionId: cp.executionId,
        workflowId: cp.workflowId,
        status: cp.status,
        currentStepId: cp.currentStepId,
        context: cp.context,
        updatedAt: new Date(cp.updatedAt),
      }).onConflictDoNothing();
      console.log(`Migrated checkpoint: ${cp.executionId}`);
    } catch (e) {
      console.error(`Failed to migrate checkpoint ${cp.executionId}`, e);
    }
  }

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch(console.error);
