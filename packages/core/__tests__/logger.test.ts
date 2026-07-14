import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreLogger } from '../src/logger';
import { ConfigManager } from '@aios/config';
import { createLogger } from '@aios/utils';

// Mock the dependencies
vi.mock('@aios/config', () => ({
  ConfigManager: {
    get: vi.fn((key: string, defaultValue: any) => {
      if (key === 'advanced.logLevel') return 'debug';
      if (key === 'ui.prefix') return '[TEST]';
      return defaultValue;
    })
  }
}));

vi.mock('@aios/utils', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

describe('CoreLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - clear instance for testing
    CoreLogger.instance = undefined;
  });

  it('should create singleton instance and initialize logger correctly', () => {
    const logger1 = CoreLogger.getInstance();
    const logger2 = CoreLogger.getInstance();
    
    expect(logger1).toBe(logger2);
    expect(ConfigManager.get).toHaveBeenCalledWith('advanced.logLevel', 'info');
    expect(ConfigManager.get).toHaveBeenCalledWith('ui.prefix', '[CORE]');
    expect(createLogger).toHaveBeenCalledWith({ level: 'debug', prefix: '[TEST]' });
  });

  it('should delegate info to internal logger', () => {
    const logger = CoreLogger.getInstance();
    logger.info('test info', { a: 1 });
    // @ts-ignore
    expect(logger.logger.info).toHaveBeenCalledWith('test info', { a: 1 });
  });

  it('should delegate warn to internal logger', () => {
    const logger = CoreLogger.getInstance();
    logger.warn('test warn', { b: 2 });
    // @ts-ignore
    expect(logger.logger.warn).toHaveBeenCalledWith('test warn', { b: 2 });
  });

  it('should delegate error to internal logger', () => {
    const logger = CoreLogger.getInstance();
    logger.error('test error');
    // @ts-ignore
    expect(logger.logger.error).toHaveBeenCalledWith('test error', undefined);
  });

  it('should delegate debug to internal logger', () => {
    const logger = CoreLogger.getInstance();
    logger.debug('test debug');
    // @ts-ignore
    expect(logger.logger.debug).toHaveBeenCalledWith('test debug', undefined);
  });
});
