import { ConfigManager } from '@aios/config';
import { MemoryManager } from './memory-manager';

export function setupIpcHandlers(ipcMain: any, mainWindow: any) {
  // IPC handlers
  ipcMain.handle('config:get', async (_ipcEvent: any, key: string, defaultValue?: any) => {
    return ConfigManager.get(key, defaultValue);
  });

  ipcMain.handle('config:set', async (_ipcEvent: any, key: string, value: any) => {
    ConfigManager.set(key, value);
  });

  ipcMain.handle('memory:init', async () => {
    const memoryManager = new MemoryManager();
    await memoryManager.init();
    return { status: 'success' };
  });

  ipcMain.handle('memory:add', async (_ipcEvent: any, record: any) => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      await memoryManager.addRecord(record);
    }
    return { status: 'success' };
  });

  ipcMain.handle('memory:search', async (_ipcEvent: any, options: any) => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      return await memoryManager.searchMemory(options);
    }
    return [];
  });

  ipcMain.handle('memory:add-many', async (_ipcEvent: any, records: any[]) => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      await memoryManager.addMany(records);
    }
    return { status: 'success' };
  });

  ipcMain.handle('memory:update', async (_ipcEvent: any, { recordId, updates }: any) => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      await memoryManager.updateRecord(recordId, updates);
    }
    return { status: 'success' };
  });

  ipcMain.handle('memory:delete', async (_ipcEvent: any, recordId: string) => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      await memoryManager.deleteRecord(recordId);
    }
    return { status: 'success' };
  });

  ipcMain.handle('memory:get-by-id', async (_ipcEvent: any, recordId: string) => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      return await memoryManager.getById(recordId);
    }
    return null;
  });

  ipcMain.handle('memory:stats', async () => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      return await memoryManager.getStats();
    }
    return {};
  });

  ipcMain.handle('memory:clear', async () => {
    const memoryManager = mainWindow?.memoryManager;
    if (memoryManager) {
      await memoryManager.clear();
    }
    return { status: 'success' };
  });
}