import { app, BrowserWindow, globalShortcut, screen } from 'electron';

// Polyfill for File in Node 18 (required by undici in OpenAI/Anthropic SDKs)
if (typeof (global as any).File === 'undefined') {
  (global as any).File = require('buffer').File;
}

import * as path from 'path';
import { CoreLogger } from '@aios/core';
import { configManager } from '@aios/config';
import { AIOSKernel } from '../kernel';
import { setupIPC } from './ipc';
import { createTray } from './tray';
import { setupAutoLaunch } from './autolaunch';
import { setupCrashReporter } from '../crash-reporter';
import { LLMConfig } from '@aios/types';

const logger = CoreLogger.getInstance();
const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let kernel: AIOSKernel | null = null;
let tray: any = null;
let launcherWindow: BrowserWindow | null = null;

async function createApplication() {
  // 1. Setup Crash Reporting
  setupCrashReporter();

  // 2. Initialize Configuration
  const allConfig = configManager.getAll();

  // Map Config to LLMConfig expected by Kernel
  const config: LLMConfig = {
    defaultProvider: allConfig.llm.defaultProvider as any,
    defaultModel: allConfig.llm.ollama.model,
    providers: {
      ollama: {
        baseUrl: allConfig.llm.ollama.host,
      },
      openai: {
        apiKey: allConfig.llm.openai.apiKey,
        baseUrl: allConfig.llm.openai.baseUrl,
      },
      anthropic: {
        apiKey: allConfig.llm.anthropic.apiKey,
      }
    } as any
  };

  try {
    // 3. Boot the AIOS Kernel (The brain)
    kernel = new AIOSKernel(config, logger);
    await kernel.boot();

    // 4. Setup Autolaunch
    setupAutoLaunch(configManager);

    // 5. Initialize IPC Handlers
    setupIPC(kernel, logger);

    logger.info('AIOS Daemon successfully initialized');
  } catch (error) {
    logger.error(`AIOS Kernel failed to boot: ${error}`);
    app.quit();
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: false, // temporarily disable transparency to see window bounds
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 6. Initialize System Tray (requires mainWindow)
  if (mainWindow && configManager) {
    tray = createTray(mainWindow, configManager);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createLauncherWindow() {
  const display = screen.getPrimaryDisplay();
  const width = 680;
  const height = 520;
  const x = Math.round(display.bounds.x + (display.size.width - width) / 2);
  const y = Math.round(display.bounds.y + (display.size.height - height) / 2 - 60);

  launcherWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    launcherWindow.loadURL('http://localhost:3000/#/launcher');
  } else {
    launcherWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: '/launcher',
    });
  }

  launcherWindow.on('blur', () => launcherWindow?.hide());
  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });
}

app.whenReady().then(async () => {
  await createApplication();
  createMainWindow();
  createLauncherWindow();

  // System-wide hotkey — works from ANY app on Windows
  globalShortcut.register('Ctrl+Alt+Space', () => {
    if (!launcherWindow || launcherWindow.isDestroyed()) {
      createLauncherWindow();
    }
    if (launcherWindow?.isVisible()) {
      launcherWindow.hide();
    } else {
      launcherWindow?.show();
      launcherWindow?.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
