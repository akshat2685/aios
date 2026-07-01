import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, LLMProviderId, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { SecretManager } from '@aios/security';
import { ConfigManager } from '@aios/config';

export class CustomProvider implements ILLMProvider {
  public readonly id: LLMProviderId = 'custom';
  public readonly name = 'Custom API';
  private logger: CoreLogger;
  private security: SecretManager;

  constructor(security: SecretManager, logger: CoreLogger) {
    this.logger = logger;
    this.security = security;
  }

  private getBaseUrl(): string {
    const config = ConfigManager.get('llm') || {};
    return config.custom?.baseUrl || 'http://localhost:8000/v1';
  }

  private async getApiKey(): Promise<string | null> {
    return await this.security.getSecret('custom_api_key');
  }

  private getClient(apiKey: string | null): AxiosInstance {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return axios.create({
      baseURL: this.getBaseUrl(),
      headers,
      timeout: 30000,
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const apiKey = await this.getApiKey();
      const client = this.getClient(apiKey);
      const messages: any[] = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const response = await client.post('/chat/completions', {
        model: request.model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stop: request.stop,
        stream: false,
      });

      return {
        content: response.data.choices[0].message.content || '',
        provider: this.id,
        model: request.model,
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      this.logger.error(`Custom generate error: ${msg}`);
      throw new Error(`Custom generate failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMStreamResponse>> {
    const self = this;
    async function* run() {
      try {
        const apiKey = await self.getApiKey();
        const client = self.getClient(apiKey);
        const messages: any[] = [];
        if (request.systemPrompt) {
          messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        const response = await client.post('/chat/completions', {
          model: request.model,
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stop: request.stop,
          stream: true,
        }, {
          responseType: 'stream',
        });

        let buffer = '';
        let promptTokens = 0;
        let completionTokens = 0;

        for await (const chunk of response.data) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            if (cleanLine === 'data: [DONE]') {
              yield { chunk: '', done: true, usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
              }};
              return;
            }

            if (cleanLine.startsWith('data: ')) {
              const jsonStr = cleanLine.substring(6);
              try {
                const json = JSON.parse(jsonStr);
                const text = json.choices?.[0]?.delta?.content || '';
                
                if (json.usage) {
                  promptTokens = json.usage.prompt_tokens || promptTokens;
                  completionTokens = json.usage.completion_tokens || completionTokens;
                } else if (text) {
                  completionTokens += 1;
                }

                yield { chunk: text, done: false };
              } catch (e: any) {
                self.logger.warn(`Failed to parse Custom stream chunk: ${e.message}`);
              }
            }
          }
        }
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        self.logger.error(`Custom stream error: ${msg}`);
        throw new Error(`Custom stream failed: ${msg}`);
      }
    }
    return run();
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      const apiKey = await this.getApiKey();
      const client = this.getClient(apiKey);
      await client.post('/chat/completions', {
        model: 'ping',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }, { timeout: 5000 });
      return { status: 'healthy' };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      return { status: 'unhealthy', error: msg };
    }
  }

  async getSupportedModels(): Promise<string[]> {
    const config = ConfigManager.get('llm') || {};
    return config.custom?.models || ['default'];
  }
}
