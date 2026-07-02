import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, LLMProviderId, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { SecretManager } from '@aios/security';

export class OpenAIProvider implements ILLMProvider {
  public readonly id: LLMProviderId = 'openai';
  public readonly name = 'OpenAI';
  private logger: CoreLogger;
  private security: SecretManager;
  private client: AxiosInstance;

  constructor(security: SecretManager, logger: CoreLogger) {
    this.logger = logger;
    this.security = security;
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
    });
  }

  private keyPool: string[] = [];
  private currentKeyIndex: number = 0;
  private lastPoolFetch: number = 0;

  private async getApiKey(): Promise<string> {
    const now = Date.now();
    if (this.keyPool.length === 0 || now - this.lastPoolFetch > 300000) {
      this.keyPool = await this.security.getSecretPool('openai_api_key');
      this.lastPoolFetch = now;
    }

    if (this.keyPool.length === 0) {
      throw new Error('OpenAI API Key is not set in security configuration');
    }

    const apiKey = this.keyPool[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keyPool.length;
    return apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const apiKey = await this.getApiKey();
      const messages: any[] = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const response = await this.client.post('/chat/completions', {
        model: request.model || 'gpt-4o',
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stop: request.stop,
        stream: false,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: request.abortSignal,
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
      this.logger.error(`OpenAI generate error: ${msg}`);
      throw new Error(`OpenAI generate failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMStreamResponse>> {
    const self = this;
    async function* run() {
      try {
        const apiKey = await self.getApiKey();
        const messages: any[] = [];
        if (request.systemPrompt) {
          messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });

        const response = await self.client.post('/chat/completions', {
          model: request.model || 'gpt-4o',
          messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stop: request.stop,
          stream: true,
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
          signal: request.abortSignal,
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
                
                // Keep track of usage if OpenAI sends it in chunks (optional API feature)
                if (json.usage) {
                  promptTokens = json.usage.prompt_tokens || promptTokens;
                  completionTokens = json.usage.completion_tokens || completionTokens;
                } else if (text) {
                  // Simple heuristic count if usage not provided
                  completionTokens += 1; // estimate
                }

                yield { chunk: text, done: false };
              } catch (e: any) {
                self.logger.warn(`Failed to parse OpenAI stream chunk: ${e.message}`);
              }
            }
          }
        }
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        self.logger.error(`OpenAI stream error: ${msg}`);
        throw new Error(`OpenAI stream failed: ${msg}`);
      }
    }
    return run();
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; latency?: number }> {
    const start = Date.now();
    try {
      const apiKey = await this.getApiKey();
      // Fast call to test connection and authorization
      await axios.get('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 5000,
      });
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      return { status: 'unhealthy', error: msg };
    }
  }

  async getSupportedModels(): Promise<string[]> {
    return [
      'gpt-4o',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
    ];
  }
}
