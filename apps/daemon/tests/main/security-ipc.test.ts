import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { setupSecurityIPC, requestFrontendApproval } from '../../src/main/security-ipc';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  }
}));

describe('security-ipc', () => {
  let mockLogger: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };
  });

  describe('setupSecurityIPC', () => {
    it('should setup IPC handler for security:resolve-approval', () => {
      setupSecurityIPC(mockLogger);
      expect(ipcMain.handle).toHaveBeenCalledWith('security:resolve-approval', expect.any(Function));
    });

    it('should resolve pending approval if it exists', async () => {
      setupSecurityIPC(mockLogger);
      const handler = (ipcMain.handle as any).mock.calls[0][1];

      const mockWebContents = { send: vi.fn() };
      const getWebContents = () => mockWebContents as any;

      const requestPromise = requestFrontendApproval({ id: 'test-id' }, getWebContents);

      const result = handler(null, { id: 'test-id', approved: 'allow_always' });
      expect(result).toBe(true);

      const resolvedValue = await requestPromise;
      expect(resolvedValue).toBe('allow_always');
      expect(mockLogger.info).toHaveBeenCalledWith('Resolved security approval test-id: allow_always');
    });

    it('should return false if resolving non-existent approval', () => {
      setupSecurityIPC(mockLogger);
      const handler = (ipcMain.handle as any).mock.calls[0][1];

      const result = handler(null, { id: 'non-existent-id', approved: 'allow_always' });
      expect(result).toBe(false);
    });
  });

  describe('requestFrontendApproval', () => {
    it('should return deny_once if webContents is not available', async () => {
      const getWebContents = () => null;
      const result = await requestFrontendApproval({ id: 'test-id' }, getWebContents);
      expect(result).toBe('deny_once');
    });

    it('should send security:request-approval if webContents is available', () => {
      const mockWebContents = { send: vi.fn() };
      const getWebContents = () => mockWebContents as any;

      requestFrontendApproval({ id: 'test-id' }, getWebContents);
      expect(mockWebContents.send).toHaveBeenCalledWith('security:request-approval', { id: 'test-id' });
    });
  });
});
