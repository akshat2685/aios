import { crashReporter } from 'electron';
import { createLogger } from '@aios/utils';

const logger = createLogger({ prefix: 'crash-reporter' });

try {
  crashReporter.start({
    submitURL: 'http://localhost:9999/crashes',
    uploadToServer: false
  });
} catch (error) {
  logger.error('Failed to start electron crash reporter', error);
}

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', error);
});

export function setupCrashReporter() {
  logger.info('Crash reporting enabled');
}