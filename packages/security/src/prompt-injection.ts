export class PromptInjectionDefense {
  private static readonly INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /disregard all prior/i,
    /system prompt/i,
    /you are now a/i,
    /bypass security/i,
    /override instructions/i
  ];

  public static isSafePrompt(prompt: string): boolean {
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(prompt)) {
        return false;
      }
    }
    return true;
  }
  
  public static sanitizePrompt(prompt: string): string {
    let sanitized = prompt;
    for (const pattern of this.INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }
}
