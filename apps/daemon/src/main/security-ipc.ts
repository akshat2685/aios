import { ipcMain } from 'electron';
import { CoreLogger } from '@aios/core';

const pendingApprovals = new Map<string, (result: string) => void>();

export function setupSecurityIPC(logger: CoreLogger) {
  ipcMain.handle('security:resolve-approval', (_, { id, approved }) => {
    const resolve = pendingApprovals.get(id);
    if (resolve) {
      resolve(approved as string);
      pendingApprovals.delete(id);
      logger.info(`Resolved security approval ${id}: ${approved}`);
      return true;
    }
    return false;
  });
}

export async function requestFrontendApproval(request: any, getWebContents: () => Electron.WebContents | null): Promise<string> {
  const webContents = getWebContents();
  if (!webContents) {
    return 'deny_once'; // Auto-deny if no UI available
  }

  return new Promise((resolve) => {
    pendingApprovals.set(request.id, resolve);
    webContents.send('security:request-approval', request);
  });
}
