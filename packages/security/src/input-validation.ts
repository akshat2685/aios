export class InputValidator {
  public static sanitizePath(inputPath: string): string {
    return inputPath.replace(/\.\./g, '');
  }

  public static sanitizeCommand(command: string): string {
    return command.replace(/[&|;]/g, '');
  }

  public static validateNoScripts(input: string): boolean {
    const scriptTagPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    return !scriptTagPattern.test(input);
  }
}
