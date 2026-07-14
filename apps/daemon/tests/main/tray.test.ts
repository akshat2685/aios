import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tray, Menu, nativeImage } from 'electron';
import { createTray } from '../../src/main/tray';

vi.mock('electron', () => ({
  Tray: vi.fn(),
  Menu: {
    buildFromTemplate: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn().mockReturnValue({
      resize: vi.fn().mockReturnValue('resized-icon')
    })
  }
}));

vi.mock('@aios/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  })
}));

describe('tray', () => {
  let mockMainWindow: any;
  let mockConfigManager: any;
  let mockTrayInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMainWindow = {
      show: vi.fn(),
      webContents: {
        send: vi.fn(),
      }
    };
    
    mockConfigManager = {
      set: vi.fn(),
    };
    
    mockTrayInstance = {
      setContextMenu: vi.fn(),
      setToolTip: vi.fn(),
      on: vi.fn(),
    };
    
    (Tray as any).mockImplementation(() => mockTrayInstance);
  });

  it('should create tray and menu', () => {
    const tray = createTray(mockMainWindow, mockConfigManager);
    
    expect(Tray).toHaveBeenCalledWith('resized-icon');
    expect(Menu.buildFromTemplate).toHaveBeenCalled();
    expect(mockTrayInstance.setContextMenu).toHaveBeenCalled();
    expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith('AIOS - Personal AI Operating System');
    expect(mockTrayInstance.on).toHaveBeenCalledWith('double-click', expect.any(Function));
    expect(mockTrayInstance.on).toHaveBeenCalledWith('click', expect.any(Function));
    expect(tray).toBe(mockTrayInstance);
  });

  it('should handle click events on tray', () => {
    createTray(mockMainWindow, mockConfigManager);
    
    const doubleClickCallback = mockTrayInstance.on.mock.calls.find((call: any[]) => call[0] === 'double-click')[1];
    doubleClickCallback();
    expect(mockMainWindow.show).toHaveBeenCalledTimes(1);

    const clickCallback = mockTrayInstance.on.mock.calls.find((call: any[]) => call[0] === 'click')[1];
    clickCallback();
    expect(mockMainWindow.show).toHaveBeenCalledTimes(2);
  });

  describe('menu items', () => {
    it('should trigger correct actions for menu items', () => {
      createTray(mockMainWindow, mockConfigManager);
      
      const template = (Menu.buildFromTemplate as any).mock.calls[0][0];
      
      // Show AIOS
      template[0].click();
      expect(mockMainWindow.show).toHaveBeenCalledTimes(1);
      
      // New Chat
      template[1].click();
      expect(mockMainWindow.show).toHaveBeenCalledTimes(2);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('chat:new');
      
      // Command Palette
      template[2].click();
      expect(mockMainWindow.show).toHaveBeenCalledTimes(3);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('command:palette');
      
      // Agent Launcher
      template[3].click();
      expect(mockMainWindow.show).toHaveBeenCalledTimes(4);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('agent-launcher:toggle');
      
      // Settings
      template[5].click();
      expect(mockMainWindow.show).toHaveBeenCalledTimes(5);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('settings:open');
      
      // Quit
      template[7].click();
      expect(mockConfigManager.set).toHaveBeenCalledWith('minimizeToTray', false);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('app:quit');
    });
  });
});
