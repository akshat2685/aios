import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, LLMProviderId, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { CoreLogger } from '@aios/core';

export interface LocalModel {
  id: string;
  type: 'chat' | 'coding';
  provider: 'ollama';
  installed: boolean;
}

export class OllamaProvider implements ILLMProvider {
  public readonly id: LLMProviderId = 'ollama';
  public readonly name = 'Ollama';
  private client: AxiosInstance;
  private logger: CoreLogger;
  public registry: LocalModel[] = [];
  private isHealthy: boolean = false;
  private watchdogInterval: NodeJS.Timeout | null = null;

  constructor(config: { baseUrl?: string }, logger: CoreLogger) {
    this.logger = logger;
    this.client = axios.create({
      baseURL: config.baseUrl || 'http://localhost:11434',
      timeout: 30000,
    });
    this.initWatchdog();
  }

  private initWatchdog() {
    this.checkHealthAndTags();
    this.watchdogInterval = setInterval(() => {
      this.checkHealthAndTags();
    }, 30000);
  }

  private async checkHealthAndTags() {
    try {
      const response = await this.client.get('/api/tags', { timeout: 5000 });
      this.isHealthy = true;
      const models = response.data?.models || [];
      
      const newRegistry: LocalModel[] = models.map((m: any) => {
        const id = m.name;
        const type = id.toLowerCase().includes('coder') ? 'coding' : 'chat';
        return {
          id,
          type,
          provider: 'ollama',
          installed: true
        };
      });
      
      this.registry = newRegistry;
    } catch (error: any) {
      this.isHealthy = false;
      this.logger.warn(`Ollama watchdog: Local AI Unavailable (${error.message})`);
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.isHealthy) throw new Error('Local AI Unavailable');
    try {
      const response = await this.client.post('/api/generate', {
        model: request.model,
        prompt: request.prompt,
        system: request.systemPrompt,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stop,
        },
      }, {
        signal: request.abortSignal
      });

      return {
        content: response.data.response,
        provider: this.id,
        model: request.model,
        usage: {
          promptTokens: response.data.prompt_eval,
          completionTokens: response.data.eval_count,
          totalTokens: response.data.prompt_eval + response.data.eval_count,
        },
      };
    } catch (error: any) {
      this.logger.error(`Ollama generate error: ${error.message}`);
      throw error;
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMStreamResponse>> {
    if (!this.isHealthy) throw new Error('Local AI Unavailable');
    const self = this;
    async function* run() {
      try {
        const response = await self.client.post('/api/generate', {
          model: request.model,
          prompt: request.prompt,
          system: request.systemPrompt,
          stream: true,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
            stop: request.stop,
          },
        }, { responseType: 'stream', signal: request.abortSignal });

        let buffer = '';
        for await (const chunk of response.data) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            try {
              const json = JSON.parse(line);
              if (json.done) {
                yield { chunk: '', done: true, usage: {
                  promptTokens: json.prompt_eval || 0,
                  completionTokens: json.eval_count || 0,
                  totalTokens: (json.prompt_eval || 0) + (json.eval_count || 0),
                }};
              } else {
                yield { chunk: json.response, done: false };
              }
            } catch (e: any) {
              self.logger.warn(`Failed to parse Ollama stream line: ${line} - ${e.message}`);
            }
          }
        }

        if (buffer.trim()) {
          try {
            const json = JSON.parse(buffer);
            if (json.done) {
              yield { chunk: '', done: true, usage: {
                promptTokens: json.prompt_eval || 0,
                completionTokens: json.eval_count || 0,
                totalTokens: (json.prompt_eval || 0) + (json.eval_count || 0),
              }};
            } else {
              yield { chunk: json.response, done: false };
            }
          } catch (e: any) {
            // ignore
          }
        }
      } catch (error: any) {
        self.logger.error(`Ollama stream error: ${error.message}`);
        throw error;
      }
    }
    return run();
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; latency?: number }> {
    const start = Date.now();
    try {
      // Basic ping test to confirm it can actually generate
      await this.client.post('/api/generate', {
        model: this.registry[0]?.id || 'llama3.2',
        prompt: 'ping',
        stream: false,
        options: { num_predict: 2 }
      }, { timeout: 10000 });
      return { status: 'healthy', latency: Date.now() - start };
    } catch (e: any) {
      this.isHealthy = false;
      return { status: 'unhealthy', error: e.message };
    }
  }

  async getSupportedModels(): Promise<string[]> {
    return this.registry.map(m => m.id);
  }
}