import { exec } from 'child_process';
import { promisify } from 'util';
import { CoreLogger } from '@aios/core';

const execAsync = promisify(exec);

export class TerminalController {
  private logger: CoreLogger;
  
  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  async runShellCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    this.logger.info(`Executing shell command: ${command}`);
    try {
      const { stdout, stderr } = await execAsync(command, { cwd });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      this.logger.error(`Shell command failed: ${error.message}`);
      return { 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message, 
        exitCode: error.code || 1 
      };
    }
  }
}
