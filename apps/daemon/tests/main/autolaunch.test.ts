import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from 'electron';
import { setupAutoLaunch, setAutoLaunch, getAutoLaunchStatus } from '../../src/main/autolaunch';

vi.mock('electron', () => ({
  app: {
    setLoginItemSettings: vi.fn(),
    getLoginItemSettings: vi.fn(),
  }
}));

vi.mock('@aios/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  })
}));

describe('autolaunch', () => {
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    vi.resetAllMocks();
    originalPlatform = process.platform;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, 'platform', {
      value: platform
    });
  };

  describe('setupAutoLaunch', () => {
    it('should set auto launch when platform is win32', () => {
      setPlatform('win32');
      const configManager = {
        get: vi.fn().mockReturnValue(true)
      };
      setupAutoLaunch(configManager as any);
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: true
      });
    });

    it('should set auto launch to false when config is false', () => {
      setPlatform('win32');
      const configManager = {
        get: vi.fn().mockReturnValue(false)
      };
      setupAutoLaunch(configManager as any);
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: true
      });
    });

    it('should do nothing when platform is not win32', () => {
      setPlatform('darwin');
      const configManager = {
        get: vi.fn().mockReturnValue(true)
      };
      setupAutoLaunch(configManager as any);
      expect(app.setLoginItemSettings).not.toHaveBeenCalled();
    });

    it('should handle error when setting auto launch fails', () => {
      setPlatform('win32');
      const configManager = {
        get: vi.fn().mockReturnValue(true)
      };
      (app.setLoginItemSettings as any).mockImplementation(() => {
        throw new Error('Test error');
      });
      expect(() => setupAutoLaunch(configManager as any)).not.toThrow();
    });
  });

  describe('setAutoLaunch', () => {
    it('should set auto launch to true when platform is win32', () => {
      setPlatform('win32');
      setAutoLaunch(true);
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        openAsHidden: true
      });
    });

    it('should set auto launch to false when platform is win32', () => {
      setPlatform('win32');
      setAutoLaunch(false);
      expect(app.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
        openAsHidden: true
      });
    });

    it('should do nothing when platform is not win32', () => {
      setPlatform('darwin');
      setAutoLaunch(true);
      expect(app.setLoginItemSettings).not.toHaveBeenCalled();
    });

    it('should handle error when setting auto launch fails', () => {
      setPlatform('win32');
      (app.setLoginItemSettings as any).mockImplementation(() => {
        throw new Error('Test error');
      });
      expect(() => setAutoLaunch(true)).not.toThrow();
    });
  });

  describe('getAutoLaunchStatus', () => {
    it('should get auto launch status when platform is win32', () => {
      setPlatform('win32');
      (app.getLoginItemSettings as any).mockReturnValue({ openAtLogin: true });
      const status = getAutoLaunchStatus();
      expect(status).toBe(true);
    });

    it('should return false when getting auto launch status fails', () => {
      setPlatform('win32');
      (app.getLoginItemSettings as any).mockImplementation(() => {
        throw new Error('Test error');
      });
      const status = getAutoLaunchStatus();
      expect(status).toBe(false);
    });

    it('should return false when platform is not win32', () => {
      setPlatform('darwin');
      const status = getAutoLaunchStatus();
      expect(status).toBe(false);
    });
  });
});
