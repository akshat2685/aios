import { app } from 'electron';
import { createLogger } from '@aios/utils';
import { ConfigManager } from '@aios/config';

const logger = createLogger({ prefix: 'autolaunch' });

export function setupAutoLaunch(configManager: ConfigManager) {
  const shouldAutoLaunch = configManager.get('autoLaunch', true);

  if (process.platform === 'win32') {
    try {
      app.setLoginItemSettings({
        openAtLogin: shouldAutoLaunch,
        openAsHidden: true,
      });
      logger.info(`Auto-launch ${shouldAutoLaunch ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to set auto-launch', error);
    }
  }
}

export function setAutoLaunch(enabled: boolean) {
  if (process.platform === 'win32') {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
      });
      logger.info(`Auto-launch ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error('Failed to set auto-launch', error);
    }
  }
}

export function getAutoLaunchStatus(): boolean {
  if (process.platform === 'win32') {
    try {
      const settings = app.getLoginItemSettings();
      return settings.openAtLogin;
    } catch {
      return false;
    }
  }
  return false;
}