import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, LLMProviderId, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { CoreLogger } from '@aios/core';

export class OllamaProvider implements ILLMProvider {
  public readonly id: LLMProviderId = 'ollama';
  public readonly name = 'Ollama';
  private client: AxiosInstance;
  private logger: CoreLogger;

  constructor(config: { baseUrl?: string }, logger: CoreLogger) {
    this.logger = logger;
    this.client = axios.create({
      baseURL: config.baseUrl || 'http://localhost:11434',
      timeout: 30000,
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
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
        }, { responseType: 'stream' });

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
                  promptTokens: json.prompt_eval,
                  completionTokens: json.eval_count,
                  totalTokens: json.prompt_eval + json.eval_count,
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
                promptTokens: json.prompt_eval,
                completionTokens: json.eval_count,
                totalTokens: json.prompt_eval + json.eval_count,
              }};
            } else {
              yield { chunk: json.response, done: false };
            }
          } catch (e) {
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

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      await this.client.get('/api/tags');
      return { status: 'healthy' };
    } catch (error: any) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  async getSupportedModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models.map((m: any) => m.name);
    } catch (error: any) {
      this.logger.error(`Ollama getModels error: ${error.message}`);
      return [];
    }
  }
}