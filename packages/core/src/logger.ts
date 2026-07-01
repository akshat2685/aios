import { ConfigManager } from '@aios/config';
import { createLogger } from '@aios/utils';

export class CoreLogger {
  private static instance: CoreLogger;
  private logger: ReturnType<typeof createLogger>;

  private constructor() {
    const config = ConfigManager.get('advanced.logLevel', 'info');
    const prefix = ConfigManager.get('ui.prefix', '[CORE]');
    this.logger = createLogger({ level: config as any, prefix });
  }

  public static getInstance(): CoreLogger {
    if (!CoreLogger.instance) {
      CoreLogger.instance = new CoreLogger();
    }
    return CoreLogger.instance;
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}