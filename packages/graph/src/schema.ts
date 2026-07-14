import { pgTable, text, timestamp, varchar, index, jsonb, boolean } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: varchar('id', { length: 255 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(), // Multi-tenancy
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    tenantIdx: index('projects_tenant_idx').on(table.tenantId)
  }
});

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 255 }).primaryKey(),
  projectId: varchar('project_id', { length: 255 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('todo'),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    projectIdx: index('tasks_project_idx').on(table.projectId)
  }
});

export const taskFiles = pgTable('task_files', {
  id: varchar('id', { length: 255 }).primaryKey(),
  taskId: varchar('task_id', { length: 255 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    taskIdx: index('task_files_task_idx').on(table.taskId)
  }
});

export const workflows = pgTable('workflows', {
  id: varchar('id', { length: 255 }).primaryKey(),
  tenantId: varchar('tenant_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  trigger: jsonb('trigger').notNull(),
  steps: jsonb('steps').notNull(),
  uiData: jsonb('ui_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    tenantIdx: index('workflows_tenant_idx').on(table.tenantId)
  }
});

export const workflowCheckpoints = pgTable('workflow_checkpoints', {
  executionId: varchar('execution_id', { length: 255 }).primaryKey(),
  workflowId: varchar('workflow_id', { length: 255 }).notNull().references(() => workflows.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).notNull(),
  currentStepId: varchar('current_step_id', { length: 255 }).notNull(),
  context: jsonb('context').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => {
  return {
    workflowIdx: index('workflow_checkpoints_workflow_idx').on(table.workflowId)
  }
});
