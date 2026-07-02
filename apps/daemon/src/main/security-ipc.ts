import { ipcMain } from 'electron';
import { CoreLogger } from '@aios/core';

const pendingApprovals = new Map<string, (result: boolean) => void>();

export function setupSecurityIPC(logger: CoreLogger) {
  ipcMain.handle('security:resolve-approval', (_, { id, approved }) => {
    const resolve = pendingApprovals.get(id);
    if (resolve) {
      resolve(approved);
      pendingApprovals.delete(id);
      logger.info(`Resolved security approval ${id}: ${approved}`);
      return true;
    }
    return false;
  });
}

export async function requestFrontendApproval(request: any, getWebContents: () => Electron.WebContents | null): Promise<boolean> {
  const webContents = getWebContents();
  if (!webContents) {
    return false; // Auto-deny if no UI available
  }

  return new Promise((resolve) => {
    pendingApprovals.set(request.id, resolve);
    webContents.send('security:request-approval', request);
  });
}
