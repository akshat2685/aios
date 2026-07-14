import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ConfigManager, configManager, ConfigSchema } from '../src/config-manager';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock('js-yaml', () => ({
  load: vi.fn(),
  dump: vi.fn(),
}));

vi.mock('conf', () => {
  return {
    default: class MockConf {
      store: any;
      constructor(options: any) {
        this.store = options.defaults ? JSON.parse(JSON.stringify(options.defaults)) : {};
        if (options.migrations && options.migrations['0.1.0']) {
          const storeMock = {
            has: vi.fn().mockReturnValue(false),
            set: vi.fn()
          };
          options.migrations['0.1.0'](storeMock);
          
          const storeMockHas = {
            has: vi.fn().mockReturnValue(true),
            set: vi.fn()
          };
          options.migrations['0.1.0'](storeMockHas);
        }
      }
    }
  };
});

vi.mock('electron', () => {
  if (process.env.MOCK_ELECTRON_THROW) {
    throw new Error('Module not found');
  }
  return {
    app: { getPath: vi.fn().mockReturnValue('/electron/path') }
  };
});

vi.mock('@aios/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MOCK_ELECTRON_THROW;
  });

  it('should initialize with electron when available', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const manager = new ConfigManager();
    expect(manager.get('theme')).toBe('system');
  });

  it('should initialize with os fallback when electron is not available', () => {
    process.env.MOCK_ELECTRON_THROW = '1';
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    const manager = new ConfigManager();
    expect(fs.mkdirSync).toHaveBeenCalled();
  });

  it('should load from yaml if exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('theme: dark');
    vi.mocked(yaml.load).mockReturnValue({ theme: 'dark' });
    
    const manager = new ConfigManager();
    expect(manager.get('theme')).toBe('dark');
  });

  it('should handle yaml load error', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('Read error'); });
    
    const manager = new ConfigManager();
    expect(manager.get('theme')).toBe('system'); // default
  });

  it('should get nested properties and default values', () => {
    const manager = new ConfigManager();
    expect(manager.get('llm.ollama.host')).toBe('http://127.0.0.1:11434');
    expect(manager.get('non.existent', 'default')).toBe('default');
    expect(manager.get('non.existent.again')).toBe(undefined);
  });

  it('should set nested properties and notify listeners', () => {
    const manager = new ConfigManager();
    
    const listener = vi.fn();
    const wildcardListener = vi.fn();
    
    manager.on('ui.animationSpeed', listener);
    manager.on('*', wildcardListener);
    
    manager.set('ui.animationSpeed', 2);
    expect(manager.get('ui.animationSpeed')).toBe(2);
    
    expect(listener).toHaveBeenCalledWith(2);
    expect(wildcardListener).toHaveBeenCalledWith({
      key: 'ui.animationSpeed',
      newValue: 2,
      oldValue: 1
    });

    // test setting new nested object
    manager.set('new.nested.value', 10);
    expect(manager.get('new.nested.value')).toBe(10);
    
    manager.set('some.undefined.value', undefined);
    expect(manager.get('some.undefined.value', 'fallback')).toBe('fallback');
  });
  
  it('should save config to yaml', () => {
    const manager = new ConfigManager();
    vi.mocked(yaml.dump).mockReturnValue('yaml content');
    
    manager.save();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should handle save error', () => {
    const manager = new ConfigManager();
    vi.mocked(yaml.dump).mockImplementation(() => { throw new Error('Dump error'); });
    
    // Should not throw
    manager.save();
  });

  it('should reset config to defaults', () => {
    const manager = new ConfigManager();
    // Use deep copy to prevent mutating the global DEFAULT_CONFIG reference since set() mutates
    manager.set('theme', 'light');
    expect(manager.get('theme')).toBe('light');
    
    manager.reset();
    expect(manager.get('theme')).toBe('system');
  });

  it('should get all config', () => {
    const manager = new ConfigManager();
    manager.set('theme', 'dark');
    const all = manager.getAll();
    expect(all.theme).toBe('dark');
  });

  it('should validate config correctly', () => {
    const manager = new ConfigManager();
    const result = manager.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);

    // Force invalid by setting wrong type
    manager.set('theme', 'invalid-theme' as any);
    const resultInvalid = manager.validate();
    expect(resultInvalid.valid).toBe(false);
    expect(resultInvalid.errors.length).toBeGreaterThan(0);
  });

  it('should unregister listener', () => {
    const manager = new ConfigManager();
    const listener = vi.fn();
    const unsub = manager.on('theme', listener);
    unsub();
    manager.set('theme', 'light');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should test static methods', () => {
    expect(ConfigManager.getAll()).toBeDefined();
    
    ConfigManager.set('theme', 'system');
    expect(ConfigManager.get('theme')).toBe('system');
    
    // Test static save, reset
    ConfigManager.save();
    ConfigManager.reset();
  });
});
