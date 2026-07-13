import { describe, it, expect } from 'vitest';
import { PluginSandbox } from '../src/plugin-isolation';

describe('PluginSandbox', () => {
  it('allows explicit modules and denies implicit native modules', () => {
    const sandbox = new PluginSandbox({ allowedModules: ['fs'] });
    expect(sandbox.validateImport('fs')).toBe(true);
    expect(sandbox.validateImport('child_process')).toBe(false);
    expect(sandbox.validateImport('lodash')).toBe(true);
  });

  it('validates network requests correctly', () => {
    const sandboxNoNet = new PluginSandbox({ networkAllowed: false });
    expect(sandboxNoNet.canMakeNetworkRequest('http://example.com')).toBe(false);
    
    const sandboxNet = new PluginSandbox({ networkAllowed: true });
    expect(sandboxNet.canMakeNetworkRequest('http://example.com')).toBe(true);
  });
});
