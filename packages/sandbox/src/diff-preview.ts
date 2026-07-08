import { CoreLogger } from '@aios/core';
import { SandboxSession } from '@aios/types';
import { SandboxRuntime } from './sandbox-runtime';

/**
 * DiffPreview — Pre-execution change preview generator.
 *
 * Generates unified diffs of all changes a sandboxed plan would make,
 * compares sandboxed FS state against the real FS state, and produces
 * a human-readable change summary.
 */
export class DiffPreview {
  private logger: CoreLogger;
  private runtime: SandboxRuntime;

  constructor(logger: CoreLogger, runtime: SandboxRuntime) {
    this.logger = logger;
    this.runtime = runtime;
    this.logger.info('DiffPreview initialized');
  }

  /**
   * Generate a unified diff of all file changes in a sandbox session.
   */
  public async generateUnifiedDiff(sessionId: string): Promise<string> {
    const session = this.runtime.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    this.logger.info(`Generating unified diff for session ${sessionId}`);

    // Stub: In production, this would:
    // 1. Walk the sandbox virtual filesystem
    // 2. For each file, compare against the real filesystem equivalent
    // 3. Generate unified diff format output
    // 4. Concatenate all diffs

    const diffs: string[] = [];

    for (const execution of session.executions) {
      for (const filePath of execution.filesCreated) {
        diffs.push(this.formatNewFileDiff(filePath));
      }
      for (const filePath of execution.filesModified) {
        diffs.push(this.formatModifiedFileDiff(filePath, '', ''));
      }
      for (const filePath of execution.filesDeleted) {
        diffs.push(this.formatDeletedFileDiff(filePath));
      }
    }

    return diffs.join('\n');
  }

  /**
   * Generate a human-readable change summary.
   */
  public async generateChangeSummary(sessionId: string): Promise<string> {
    const session = this.runtime.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const lines: string[] = [
      `# Sandbox Change Summary: ${session.name}`,
      '',
      `**Status**: ${session.status}`,
      `**Steps Executed**: ${session.executions.length}`,
      `**Duration**: ${session.resources.elapsedMs}ms`,
      '',
      '## Resource Usage',
      `- Files Created: ${session.resources.filesCreated}`,
      `- Files Modified: ${session.resources.filesModified}`,
      `- Files Deleted: ${session.resources.filesDeleted}`,
      `- Total Bytes Written: ${this.formatBytes(session.resources.totalBytesWritten)}`,
      '',
      '## Execution Steps',
    ];

    for (const exec of session.executions) {
      const statusIcon = exec.exitCode === 0 ? '✅' : '❌';
      lines.push(`${statusIcon} Step ${exec.stepIndex + 1}: \`${exec.command}\` (${exec.durationMs}ms)`);
      if (exec.filesCreated.length > 0) {
        lines.push(`   + Created: ${exec.filesCreated.join(', ')}`);
      }
      if (exec.filesModified.length > 0) {
        lines.push(`   ~ Modified: ${exec.filesModified.join(', ')}`);
      }
      if (exec.filesDeleted.length > 0) {
        lines.push(`   - Deleted: ${exec.filesDeleted.join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Compare sandbox state against real filesystem to identify
   * what would change if the sandbox changes are promoted.
   */
  public async compareWithRealFs(
    sessionId: string,
    realWorkspacePath: string
  ): Promise<Array<{
    path: string;
    type: 'create' | 'modify' | 'delete';
    sandboxContent?: string;
    realContent?: string;
  }>> {
    this.logger.info(`Comparing sandbox ${sessionId} with real FS at ${realWorkspacePath}`);

    // Stub: Walk sandbox FS and real FS, compute differences
    return [];
  }

  /**
   * Promote sandbox changes to the real filesystem.
   * This is the "apply changes" action from the UI.
   */
  public async promoteToReal(
    sessionId: string,
    realWorkspacePath: string
  ): Promise<{ appliedFiles: number; errors: string[] }> {
    this.logger.info(`Promoting sandbox ${sessionId} changes to ${realWorkspacePath}`);

    // Stub: Copy all sandbox files to real workspace
    // In production, this would iterate the diff and apply each change
    // with proper error handling and rollback support

    return { appliedFiles: 0, errors: [] };
  }

  // ─── Private ───────────────────────────────────────────────

  private formatNewFileDiff(filePath: string): string {
    return [
      `--- /dev/null`,
      `+++ b/${filePath}`,
      `@@ -0,0 +1 @@`,
      `+[new file]`,
    ].join('\n');
  }

  private formatModifiedFileDiff(filePath: string, oldContent: string, newContent: string): string {
    return [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ modified @@`,
    ].join('\n');
  }

  private formatDeletedFileDiff(filePath: string): string {
    return [
      `--- a/${filePath}`,
      `+++ /dev/null`,
      `@@ deleted @@`,
    ].join('\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
