import { describe, it, expect } from 'vitest';
import { InputValidator } from '../src/input-validation';

describe('InputValidator', () => {
  it('sanitizes paths correctly', () => {
    expect(() => InputValidator.sanitizePath('../../etc/passwd')).toThrow('Invalid path: Traversal or absolute paths are not allowed');
    expect(() => InputValidator.sanitizePath('/etc/passwd')).toThrow('Invalid path: Traversal or absolute paths are not allowed');
    expect(InputValidator.sanitizePath('valid/path/file.txt')).toBe(require('path').normalize('valid/path/file.txt'));
  });

  it('sanitizes shell commands', () => {
    expect(() => InputValidator.sanitizeCommand('echo "hello" & rm -rf /')).toThrow('Invalid command: Contains forbidden shell characters');
    expect(() => InputValidator.sanitizeCommand('ls | grep "foo" ; bash')).toThrow('Invalid command: Contains forbidden shell characters');
    expect(InputValidator.sanitizeCommand('echo "hello"')).toBe('echo "hello"');
  });

  it('validates scripts', () => {
    expect(InputValidator.validateNoScripts('hello world')).toBe(true);
    expect(InputValidator.validateNoScripts('<script>alert("xss")</script>')).toBe(false);
    expect(InputValidator.validateNoScripts('<img src=x onerror=alert(1)>')).toBe(false);
    expect(InputValidator.validateNoScripts('javascript:alert(1)')).toBe(false);
  });
});
