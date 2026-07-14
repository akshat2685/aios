import * as path from 'path';

export class InputValidator {
  public static sanitizePath(inputPath: string): string {
    if (inputPath.indexOf('\0') !== -1) {
      throw new Error('Invalid path: Contains null bytes');
    }
    const normalized = path.normalize(inputPath);
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid path: Traversal or absolute paths are not allowed');
    }
    return normalized;
  }

  public static sanitizeCommand(command: string): string {
    if (/[&|;$`><\n\r]/.test(command)) {
      throw new Error('Invalid command: Contains forbidden shell characters');
    }
    return command;
  }

  public static validateNoScripts(input: string): boolean {
    const scriptTagPattern = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
    const eventHandlerPattern = /on\w+\s*=/gi;
    const jsUriPattern = /javascript:/gi;
    return !scriptTagPattern.test(input) && !eventHandlerPattern.test(input) && !jsUriPattern.test(input);
  }
}
