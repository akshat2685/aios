import * as path from 'path';
import * as fs from 'fs';
import Conf from 'conf';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { createLogger } from '@aios/utils';

const logger = createLogger({ prefix: 'config' });

export const ConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().default('en'),
  autoLaunch: z.boolean().default(true),
  minimizeToTray: z.boolean().default(true),
  startMinimized: z.boolean().default(false),
  cloudMode: z.enum(['local', 'online']).default('local'),
  llm: z.object({
    defaultProvider: z.enum(['ollama', 'lmstudio', 'openai', 'anthropic', 'gemini', 'nvidia', 'openrouter', 'custom', 'local']).default('ollama'),
    routingProfile: z.enum(['BALANCED', 'FASTEST', 'CHEAPEST', 'HIGHEST_QUALITY']).default('BALANCED'),
    cloudMode: z.enum(['local', 'online']).default('local'),
    routingMode: z.enum(['automatic', 'advanced']).default('automatic'),
    ollama: z.object({
      host: z.string().default('http://127.0.0.1:11434'),
      model: z.string().default('llama3.2'),
      temperature: z.number().default(0.7),
      maxTokens: z.number().default(4096),
    }),
    lmstudio: z.object({
      host: z.string().default('http://127.0.0.1:1234'),
      model: z.string().default(''),
    }),
    openai: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('gpt-4o'),
      baseUrl: z.string().optional(),
    }),
    anthropic: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('claude-3-5-sonnet-20241022'),
    }),
    gemini: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('gemini-1.5-pro'),
    }),
    nvidia: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('nemotron-3-ultra'),
    }),
    openrouter: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('meta-llama/llama-3-8b-instruct:free'),
    }),
    custom: z.object({
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
      model: z.string().default(''),
    }),
    // Local model preferences
    localModels: z.object({
      generalModel: z.string().optional(),
      codingModel: z.string().optional(),
    }).optional(),
    // User preferences for routing
    userPreferences: z.object({
      preferLocal: z.boolean().default(false),
      preferOpenSource: z.boolean().default(false),
      preferCheapest: z.boolean().default(false),
      preferredProviders: z.array(z.string()).optional(),
      disabledProviders: z.array(z.string()).optional(),
      disabledModels: z.array(z.string()).optional(),
    }).optional(),
  }),
  memory: z.object({
    databasePath: z.string().default(''),
    maxEntries: z.number().default(100000),
    embeddingModel: z.string().default('all-minilm'),
    embeddingDim: z.number().default(384),
    hnsw: z.object({
      m: z.number().default(16),
      efConstruction: z.number().default(200),
      efSearch: z.number().default(50),
    }),
  }),
  memoryIngestion: z.object({
    fileWatcher: z.object({
      enabled: z.boolean().default(true),
      paths: z.array(z.string()).default([]),
      excludePatterns: z.array(z.string()).default(['node_modules', '.git', 'dist', 'build', '*.log', '*.tmp']),
      debounceMs: z.number().default(1000),
    }),
    clipboard: z.object({
      enabled: z.boolean().default(true),
      maxLength: z.number().default(10000),
    }),
    browser: z.object({
      enabled: z.boolean().default(false),
      browsers: z.array(z.string()).default(['chrome', 'edge', 'firefox']),
    }),
    screenCapture: z.object({
      enabled: z.boolean().default(false),
      intervalMs: z.number().default(30000),
      ocrEnabled: z.boolean().default(true),
    }),
  }),
  agents: z.object({
    maxConcurrent: z.number().default(5),
    defaultTimeout: z.number().default(300000),
    memoryIsolation: z.boolean().default(true),
    modelOverrides: z.record(z.object({
      provider: z.string().optional(),
      model: z.string().optional(),
    })).default({}),
  }),
  ui: z.object({
    animationSpeed: z.number().default(1),
    compactMode: z.boolean().default(false),
    showTimestamps: z.boolean().default(true),
    fontSize: z.number().default(14),
    fontFamily: z.string().default('system'),
  }),
  privacy: z.object({
    telemetry: z.boolean().default(false),
    crashReporting: z.boolean().default(false),
    localOnly: z.boolean().default(true),
    encryptMemory: z.boolean().default(false),
  }),
  advanced: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    maxLogFiles: z.number().default(10),
    maxLogSizeMb: z.number().default(10),
    enableProfiling: z.boolean().default(false),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: Config = {
  theme: 'system',
  language: 'en',
  autoLaunch: true,
  minimizeToTray: true,
  startMinimized: false,
  cloudMode: 'local',
  llm: {
    defaultProvider: 'ollama',
    routingProfile: 'BALANCED',
    cloudMode: 'local',
    routingMode: 'automatic',
    ollama: {
      host: 'http://127.0.0.1:11434',
      model: 'llama3.2',
      temperature: 0.7,
      maxTokens: 4096,
    },
    lmstudio: {
      host: 'http://127.0.0.1:1234',
      model: '',
    },
    openai: {
      model: 'gpt-4o',
    },
    anthropic: {
      model: 'claude-3-5-sonnet-20241022',
    },
    gemini: {
      model: 'gemini-1.5-pro',
    },
    nvidia: {
      model: 'nemotron-3-ultra',
    },
    openrouter: {
      model: 'meta-llama/llama-3-8b-instruct:free',
    },
    custom: {
      model: '',
    },
    localModels: {
      generalModel: 'llama3.2:latest',
      codingModel: 'qwen2.5-coder:7b',
    },
    userPreferences: {
      preferLocal: false,
      preferOpenSource: false,
      preferCheapest: false,
    },
  },
  memory: {
    databasePath: '',
    maxEntries: 100000,
    embeddingModel: 'all-minilm',
    embeddingDim: 384,
    hnsw: {
      m: 16,
      efConstruction: 200,
      efSearch: 50,
    },
  },
  memoryIngestion: {
    fileWatcher: {
      enabled: true,
      paths: [],
      excludePatterns: ['node_modules', '.git', 'dist', 'build', 'build', '*.log', '*.tmp'],
      debounceMs: 1000,
    },
    clipboard: {
      enabled: true,
      maxLength: 10000,
    },
    browser: {
      enabled: false,
      browsers: ['chrome', 'edge', 'firefox'],
    },
    screenCapture: {
      enabled: false,
      intervalMs: 30000,
      ocrEnabled: true,
    },
  },
  agents: {
    maxConcurrent: 5,
    defaultTimeout: 300000,
    memoryIsolation: true,
    modelOverrides: {
      assistant: { provider: 'ollama', model: 'qwen2.5:8b' },
      coder: { provider: 'ollama', model: 'qwen2.5-coder' },
      researcher: { provider: 'ollama', model: 'qwen2.5' },
      planner: { provider: 'ollama', model: 'qwen2.5' },
    },
  },
  ui: {
    animationSpeed: 1,
    compactMode: false,
    showTimestamps: true,
    fontSize: 14,
    fontFamily: 'system',
  },
  privacy: {
    telemetry: false,
    crashReporting: false,
    localOnly: true,
    encryptMemory: false,
  },
  advanced: {
    logLevel: 'info',
    maxLogFiles: 10,
    maxLogSizeMb: 10,
    enableProfiling: false,
  },
};

export class ConfigManager {
  static getAll(): Config {
    return configManager.getAll();
  }

  static get(key: string, defaultValue?: any): any {
    return configManager.get(key, defaultValue);
  }

  static set(key: string, value: any): void {
    configManager.set(key, value);
  }

  static save(): void {
    configManager.save();
  }

  static reset(): void {
    configManager.reset();
  }

  private store: Conf<Config>;
  private config: Config;
  private listeners: Map<string, Set<(value: any) => void>> = new Map();
  private configPath: string;

  constructor() {
    let userDataPath: string;
    try {
      const { app } = require('electron');
      userDataPath = app.getPath('userData');
    } catch {
      const os = require('os');
      userDataPath = path.join(os.homedir(), '.aios');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
    }
    this.configPath = path.join(userDataPath, 'config.yaml');
    this.store = new Conf<Config>({
      projectName: 'aios',
      projectVersion: '0.1.0',
      configName: 'aios',
      defaults: DEFAULT_CONFIG,
      migrations: {
        '0.1.0': (store) => {
          if (!store.has('privacy.encryptMemory')) {
            store.set('privacy.encryptMemory', false);
          }
        },
      },
    });

    this.config = this.store.store;
    this.loadFromYaml();
  }

  private loadFromYaml() {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileContents = fs.readFileSync(this.configPath, 'utf8');
        const yamlConfig = yaml.load(fileContents) as Partial<Config>;
        this.config = { ...DEFAULT_CONFIG, ...yamlConfig };
        this.store.store = this.config;
        logger.info('Loaded config from YAML');
      }
    } catch (error) {
      logger.error('Failed to load YAML config, using defaults', error);
    }
  }

  get<K extends keyof Config>(key: K): Config[K];
  get(key: string, defaultValue?: any): any;
  get(key: string, defaultValue?: any): any {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) return defaultValue;
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void;
  set(key: string, value: any): void;
  set(key: string, value: any): void {
    const keys = key.split('.');
    let obj: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }

    const oldValue = obj[keys[keys.length - 1]];
    obj[keys[keys.length - 1]] = value;

    this.notifyListeners(key, value, oldValue);
    logger.debug(`Config changed: ${key}`, { oldValue, newValue: value });
  }

  private notifyListeners(key: string, newValue: any, oldValue: any) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach((cb) => cb(newValue));
    }
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((cb) => cb({ key, newValue, oldValue }));
    }
  }

  on(key: string, callback: (value: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => this.listeners.get(key)?.delete(callback);
  }

  save() {
    try {
      const yamlStr = yaml.dump(this.config, { indent: 2 });
      fs.writeFileSync(this.configPath, yamlStr, 'utf8');
      logger.info('Config saved to YAML');
    } catch (error) {
      logger.error('Failed to save config', error);
    }
  }

  reset() {
    this.config = { ...DEFAULT_CONFIG };
    this.store.store = this.config;
    this.save();
    logger.info('Config reset to defaults');
  }

  getAll(): Config {
    return { ...this.config };
  }

  validate(): { valid: boolean; errors: string[] } {
    const result = ConfigSchema.safeParse(this.config);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return { valid: true, errors: [] };
  }
}

export const configManager = new ConfigManager();
export default configManager;