import { app, BrowserWindow } from 'electron';
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
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 6. Initialize System Tray (requires mainWindow)
  if (mainWindow && configManager) {
    tray = createTray(mainWindow, configManager);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createApplication();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
