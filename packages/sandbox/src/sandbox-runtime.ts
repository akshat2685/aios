import { CoreLogger } from '@aios/core';
import {
  SandboxSession,
  SandboxExecution,
  SandboxPolicy,
  SandboxResourceUsage,
  SandboxSessionStatus,
} from '@aios/types';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * SandboxRuntime — Isolated execution environment for safe agent testing.
 *
 * Creates temporary workspace directories for sandboxed operations. All file
 * operations are confined to a virtual filesystem overlay so writes never touch
 * the real filesystem. Commands are executed with resource limits and timeouts.
 */
export class SandboxRuntime {
  private logger: CoreLogger;
  private sessions: Map<string, SandboxSession> = new Map();
  private policy: SandboxPolicy;
  private sandboxRoot: string;

  constructor(logger: CoreLogger, policy?: Partial<SandboxPolicy>) {
    this.logger = logger;
    this.sandboxRoot = path.join(os.homedir(), '.aios', 'sandboxes');
    this.policy = {
      maxStepTimeoutMs: 30_000,
      maxSessionTimeoutMs: 300_000,
      maxFileCount: 500,
      maxTotalBytes: 100 * 1024 * 1024, // 100 MB
      allowedCommands: [],
      blockedCommands: ['rm -rf /', 'format', 'del /s /q'],
      allowNetworkAccess: false,
      ...policy,
    };
    this.logger.info('SandboxRuntime initialized');
  }

  /**
   * Create a new sandbox session with an isolated workspace.
   */
  public async createSession(name: string, taskDescription: string): Promise<SandboxSession> {
    const id = `sandbox-${crypto.randomBytes(6).toString('hex')}`;
    const virtualWorkspacePath = path.join(this.sandboxRoot, id);

    const session: SandboxSession = {
      id,
      name,
      status: 'pending',
      taskDescription,
      virtualWorkspacePath,
      executions: [],
      resources: {
        filesCreated: 0,
        filesModified: 0,
        filesDeleted: 0,
        totalBytesWritten: 0,
        elapsedMs: 0,
      },
      createdAt: Date.now(),
    };

    this.sessions.set(id, session);
    this.logger.info(`Created sandbox session: ${name} (${id})`);

    // Stub: Create the virtual workspace directory
    // In production: fs.mkdirSync(virtualWorkspacePath, { recursive: true })

    return session;
  }

  /**
   * Execute a command within a sandbox session.
   */
  public async executeCommand(
    sessionId: string,
    command: string
  ): Promise<SandboxExecution> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sandbox session ${sessionId} not found`);

    // Validate command against policy
    this.validateCommand(command);

    session.status = 'running';
    const stepIndex = session.executions.length;
    const startTime = Date.now();

    this.logger.info(`Sandbox ${sessionId} executing step ${stepIndex}: ${command}`);

    // Stub: Execute command in the sandboxed environment
    // In production, this would:
    // 1. Spawn a child process with cwd = session.virtualWorkspacePath
    // 2. Set environment variables to restrict network access
    // 3. Apply timeout from policy.maxStepTimeoutMs
    // 4. Capture stdout/stderr/exit code
    // 5. Track file system changes

    const execution: SandboxExecution = {
      stepIndex,
      command,
      stdout: '',
      stderr: '',
      exitCode: 0,
      durationMs: Date.now() - startTime,
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
    };

    session.executions.push(execution);
    this.updateResourceUsage(session, execution);

    return execution;
  }

  /**
   * Write a file within the sandbox's virtual filesystem.
   */
  public async writeFile(
    sessionId: string,
    relativePath: string,
    content: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sandbox session ${sessionId} not found`);

    // Enforce resource limits
    if (session.resources.filesCreated >= this.policy.maxFileCount) {
      throw new Error(`Sandbox file limit exceeded (max: ${this.policy.maxFileCount})`);
    }
    if (session.resources.totalBytesWritten + content.length > this.policy.maxTotalBytes) {
      throw new Error(`Sandbox byte limit exceeded (max: ${this.policy.maxTotalBytes})`);
    }

    const fullPath = path.join(session.virtualWorkspacePath, relativePath);
    this.logger.debug(`Sandbox ${sessionId} writing: ${relativePath} (${content.length} bytes)`);

    // Stub: Write to virtual FS
    // In production: fs.writeFileSync(fullPath, content)

    session.resources.filesCreated++;
    session.resources.totalBytesWritten += content.length;
  }

  /**
   * Read a file from the sandbox's virtual filesystem.
   */
  public async readFile(sessionId: string, relativePath: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sandbox session ${sessionId} not found`);

    const fullPath = path.join(session.virtualWorkspacePath, relativePath);
    this.logger.debug(`Sandbox ${sessionId} reading: ${relativePath}`);

    // Stub: Read from virtual FS
    // In production: return fs.readFileSync(fullPath, 'utf-8')
    return '';
  }

  /**
   * List files in the sandbox's virtual workspace.
   */
  public async listFiles(sessionId: string, relativePath: string = '.'): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Sandbox session ${sessionId} not found`);

    // Stub: List virtual FS
    return [];
  }

  /**
   * Complete a sandbox session and generate summary.
   */
  public async completeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const failedSteps = session.executions.filter(e => e.exitCode !== 0).length;
    session.status = failedSteps > 0 ? 'failed' : 'completed';
    session.completedAt = Date.now();
    session.resources.elapsedMs = session.completedAt - session.createdAt;

    this.logger.info(
      `Sandbox ${sessionId} ${session.status}: ${session.executions.length} steps, ` +
      `${session.resources.filesCreated} files created, ` +
      `${session.resources.totalBytesWritten} bytes written`
    );
  }

  /**
   * Destroy a sandbox session and clean up its virtual workspace.
   */
  public async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Stub: Remove the virtual workspace directory
    // In production: fs.rmSync(session.virtualWorkspacePath, { recursive: true, force: true })

    this.sessions.delete(sessionId);
    this.logger.info(`Destroyed sandbox session: ${sessionId}`);
  }

  /**
   * Get a session by ID.
   */
  public getSession(sessionId: string): SandboxSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions.
   */
  public getAllSessions(): SandboxSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get the current sandbox policy.
   */
  public getPolicy(): SandboxPolicy {
    return { ...this.policy };
  }

  // ─── Private ───────────────────────────────────────────────

  private validateCommand(command: string): void {
    for (const blocked of this.policy.blockedCommands) {
      if (command.includes(blocked)) {
        throw new Error(`Blocked command detected: "${blocked}"`);
      }
    }

    if (this.policy.allowedCommands.length > 0) {
      const cmdBase = command.split(/\s+/)[0];
      if (!this.policy.allowedCommands.includes(cmdBase)) {
        throw new Error(`Command not in allowlist: "${cmdBase}"`);
      }
    }
  }

  private updateResourceUsage(session: SandboxSession, execution: SandboxExecution): void {
    session.resources.filesCreated += execution.filesCreated.length;
    session.resources.filesModified += execution.filesModified.length;
    session.resources.filesDeleted += execution.filesDeleted.length;
  }
}
