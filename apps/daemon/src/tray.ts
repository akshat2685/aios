import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';
import { ConfigManager } from '@aios/config';
import { CoreLogger } from '@aios/core';

export function createTray(mainWindow: BrowserWindow, configManager: ConfigManager): Tray {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(icon);

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show AIOS',
        click: () => mainWindow.show(),
      },
      {
        label: 'New Chat',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('chat:new');
        },
      },
      {
        label: 'Command Palette',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('command:palette');
        },
        accelerator: 'CmdOrCtrl+Shift+Space',
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          mainWindow.show();
          mainWindow.webContents.send('settings:open');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          configManager.set('minimizeToTray', false);
          mainWindow.webContents.send('app:quit');
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  tray.setToolTip('AIOS - Personal AI Operating System');
  tray.on('double-click', () => mainWindow.show());
  tray.on('click', () => mainWindow.show());

  updateMenu();

  return tray;
}