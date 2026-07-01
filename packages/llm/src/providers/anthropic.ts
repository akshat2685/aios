import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, LLMProviderId, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { SecretManager } from '@aios/security';

export class AnthropicProvider implements ILLMProvider {
  public readonly id: LLMProviderId = 'anthropic';
  public readonly name = 'Anthropic Claude';
  private logger: CoreLogger;
  private security: SecretManager;
  private client: AxiosInstance;

  constructor(security: SecretManager, logger: CoreLogger) {
    this.logger = logger;
    this.security = security;
    this.client = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 30000,
    });
  }

  private async getApiKey(): Promise<string> {
    const apiKey = await this.security.getSecret('anthropic_api_key');
    if (!apiKey) {
      throw new Error('Anthropic API Key is not set in security configuration');
    }
    return apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const apiKey = await this.getApiKey();
      const response = await this.client.post('/messages', {
        model: request.model || 'claude-3-5-sonnet-20240620',
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        stop_sequences: request.stop,
        stream: false,
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      });

      return {
        content: response.data.content[0]?.text || '',
        provider: this.id,
        model: request.model,
        usage: {
          promptTokens: response.data.usage?.input_tokens || 0,
          completionTokens: response.data.usage?.output_tokens || 0,
          totalTokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0),
        },
      };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      this.logger.error(`Anthropic generate error: ${msg}`);
      throw new Error(`Anthropic generate failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMStreamResponse>> {
    const self = this;
    async function* run() {
      try {
        const apiKey = await self.getApiKey();
        const response = await self.client.post('/messages', {
          model: request.model || 'claude-3-5-sonnet-20240620',
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          stop_sequences: request.stop,
          stream: true,
        }, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          responseType: 'stream',
        });

        let buffer = '';
        let currentEvent = '';
        let promptTokens = 0;
        let completionTokens = 0;

        for await (const chunk of response.data) {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            if (cleanLine.startsWith('event: ')) {
              currentEvent = cleanLine.substring(7);
            } else if (cleanLine.startsWith('data: ')) {
              const dataStr = cleanLine.substring(6);
              try {
                const json = JSON.parse(dataStr);
                
                if (currentEvent === 'message_start' && json.message?.usage) {
                  promptTokens = json.message.usage.input_tokens || 0;
                } else if (currentEvent === 'content_block_delta' && json.delta?.text) {
                  yield { chunk: json.delta.text, done: false };
                } else if (currentEvent === 'message_delta' && json.usage) {
                  completionTokens = json.usage.output_tokens || 0;
                } else if (currentEvent === 'message_stop') {
                  yield { chunk: '', done: true, usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                  }};
                  return;
                }
              } catch (e: any) {
                self.logger.warn(`Failed to parse Anthropic stream data: ${e.message}`);
              }
            }
          }
        }
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        self.logger.error(`Anthropic stream error: ${msg}`);
        throw new Error(`Anthropic stream failed: ${msg}`);
      }
    }
    return run();
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string }> {
    try {
      const apiKey = await this.getApiKey();
      await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 5000,
      });
      return { status: 'healthy' };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      return { status: 'unhealthy', error: msg };
    }
  }

  async getSupportedModels(): Promise<string[]> {
    return [
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
    ];
  }
}
