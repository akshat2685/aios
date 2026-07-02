import { AgentTool } from '@aios/types';
import { TerminalController, FileSystemController, BrowserController } from '@aios/computer';
import { CoreLogger } from '@aios/core';

export function getComputerTools(
  logger: CoreLogger, 
  requestApproval?: (action: string, details: string) => Promise<boolean>
): AgentTool[] {
  const terminal = new TerminalController(logger);
  const fs = new FileSystemController(logger);
  const browser = new BrowserController(logger);

  return [
    {
      name: 'computer_run_shell',
      description: 'Run a shell command on the host machine. USE WITH CAUTION.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute.' },
          cwd: { type: 'string', description: 'Optional directory to run the command in.' }
        },
        required: ['command']
      },
      execute: async (args: any) => {
        if (requestApproval) {
          const approved = await requestApproval('shell', args.command);
          if (!approved) {
            return { error: 'User denied permission to run this command.' };
          }
        }
        return await terminal.runShellCommand(args.command, args.cwd);
      }
    },
    {
      name: 'computer_read_file',
      description: 'Read the contents of a file on the host machine.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file.' }
        },
        required: ['filePath']
      },
      execute: async (args: any) => {
        try {
          const content = await fs.readFile(args.filePath);
          return { content };
        } catch (e: any) {
          return { error: e.message };
        }
      }
    },
    {
      name: 'computer_write_file',
      description: 'Write content to a file on the host machine.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Absolute path to the file.' },
          content: { type: 'string', description: 'Content to write.' }
        },
        required: ['filePath', 'content']
      },
      execute: async (args: any) => {
        if (requestApproval) {
          const approved = await requestApproval('file_write', `Write to ${args.filePath}`);
          if (!approved) {
            return { error: 'User denied permission to write this file.' };
          }
        }
        try {
          await fs.writeFile(args.filePath, args.content);
          return { success: true };
        } catch (e: any) {
          return { error: e.message };
        }
      }
    },
    {
      name: 'computer_browser_goto',
      description: 'Navigate to a URL using the host browser and return the page text content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to.' }
        },
        required: ['url']
      },
      execute: async (args: any) => {
        if (requestApproval) {
          const approved = await requestApproval('browser', `Navigate to ${args.url}`);
          if (!approved) {
            return { error: 'User denied permission to use the browser.' };
          }
        }
        try {
          const content = await browser.goto(args.url);
          return { content };
        } catch (e: any) {
          return { error: e.message };
        }
      }
    }
  ];
}
