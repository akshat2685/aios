export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export function createLogger(options: LoggerOptions = {}): {
  info: (msg: string, meta?: any) => void;
  warn: (msg: string, meta?: any) => void;
  error: (msg: string, meta?: any) => void;
  debug: (msg: string, meta?: any) => void;
} {
  const prefix = options.prefix || '';
  return {
    info: (msg: string, meta?: any) => console.log(`[${prefix}INFO] ${msg}`, meta || ''),
    warn: (msg: string, meta?: any) => console.warn(`[${prefix}WARN] ${msg}`, meta || ''),
    error: (msg: string, meta?: any) => console.error(`[${prefix}ERROR] ${msg}`, meta || ''),
    debug: (msg: string, meta?: any) => console.debug(`[${prefix}DEBUG] ${msg}`, meta || ''),
  };
}