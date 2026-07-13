import { describe, it, expect } from 'vitest';
import { InputValidator } from '../src/input-validation';

describe('InputValidator', () => {
  it('sanitizes paths correctly', () => {
    expect(InputValidator.sanitizePath('../../etc/passwd')).toBe('//etc/passwd');
    expect(InputValidator.sanitizePath('C:\\..\\Windows')).toBe('C:\\\\Windows');
  });

  it('sanitizes shell commands', () => {
    expect(InputValidator.sanitizeCommand('echo "hello" & rm -rf /')).toBe('echo "hello"  rm -rf /');
    expect(InputValidator.sanitizeCommand('ls | grep "foo" ; bash')).toBe('ls  grep "foo"  bash');
  });

  it('validates scripts', () => {
    expect(InputValidator.validateNoScripts('hello world')).toBe(true);
    expect(InputValidator.validateNoScripts('<script>alert("xss")</script>')).toBe(false);
  });
});
