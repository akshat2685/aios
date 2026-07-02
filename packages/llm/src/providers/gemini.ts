import axios, { AxiosInstance } from 'axios';
import { ILLMProvider, LLMProviderId, LLMRequest, LLMResponse, LLMStreamResponse } from '@aios/types';
import { CoreLogger } from '@aios/core';
import { SecretManager } from '@aios/security';

export class GeminiProvider implements ILLMProvider {
  public readonly id: LLMProviderId = 'gemini';
  public readonly name = 'Google Gemini';
  private logger: CoreLogger;
  private security: SecretManager;
  private client: AxiosInstance;

  constructor(security: SecretManager, logger: CoreLogger) {
    this.logger = logger;
    this.security = security;
    this.client = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      timeout: 30000,
    });
  }

  private keyPool: string[] = [];
  private currentKeyIndex: number = 0;
  private lastPoolFetch: number = 0;

  private async getApiKey(): Promise<string> {
    const now = Date.now();
    // Refresh pool every 5 minutes in case user adds keys in UI
    if (this.keyPool.length === 0 || now - this.lastPoolFetch > 300000) {
      this.keyPool = await this.security.getSecretPool('gemini_api_key');
      this.lastPoolFetch = now;
    }

    if (this.keyPool.length === 0) {
      throw new Error('Gemini API Key is not set in security configuration');
    }

    // Round robin rotation
    const apiKey = this.keyPool[this.currentKeyIndex];
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keyPool.length;
    return apiKey;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    try {
      const apiKey = await this.getApiKey();
      const model = request.model || 'gemini-2.5-flash';
      
      const contents = [{
        parts: [{ text: request.prompt }]
      }];

      const body: any = {
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
          stopSequences: request.stop,
        }
      };

      if (request.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: request.systemPrompt }]
        };
      }

      const response = await this.client.post(`/models/${model}:generateContent?key=${apiKey}`, body, {
        signal: request.abortSignal,
      });
      const candidates = response.data.candidates || [];
      const text = candidates[0]?.content?.parts?.[0]?.text || '';
      const usage = response.data.usageMetadata || {};

      return {
        content: text,
        provider: this.id,
        model: request.model,
        usage: {
          promptTokens: usage.promptTokenCount || 0,
          completionTokens: usage.candidatesTokenCount || 0,
          totalTokens: usage.totalTokenCount || 0,
        },
      };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      this.logger.error(`Gemini generate error: ${msg}`);
      throw new Error(`Gemini generate failed: ${msg}`);
    }
  }

  async stream(request: LLMRequest): Promise<AsyncGenerator<LLMStreamResponse>> {
    const self = this;
    async function* run() {
      try {
        const apiKey = await self.getApiKey();
        const model = request.model || 'gemini-2.5-flash';

        const contents = [{
          parts: [{ text: request.prompt }]
        }];

        const body: any = {
          contents,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens,
            stopSequences: request.stop,
          }
        };

        if (request.systemPrompt) {
          body.systemInstruction = {
            parts: [{ text: request.systemPrompt }]
          };
        }

        const response = await self.client.post(`/models/${model}:streamGenerateContent?key=${apiKey}`, body, {
          responseType: 'stream',
          signal: request.abortSignal,
        });

        let buffer = '';
        let promptTokens = 0;
        let completionTokens = 0;

        for await (const chunk of response.data) {
          buffer += chunk.toString();
          
          // Gemini sends a JSON array stream: [ {...}, {...} ]
          // We can parse blocks by matching brackets or simple split-by-comma logic if we clean up
          // A robust way: find complete JSON object structures using regex or bracket counting
          // Since Gemini output is formatted, each candidate block is typically separated by commas.
          
          // Split by commas while balancing brackets is complex. But we can split by "}\r\n," or "}\n,"
          // Or find individual objects. Let's extract JSON objects using a simple index scanner:
          let openBrackets = 0;
          let startIndex = -1;
          
          for (let i = 0; i < buffer.length; i++) {
            const char = buffer[i];
            if (char === '{') {
              if (openBrackets === 0) {
                startIndex = i;
              }
              openBrackets++;
            } else if (char === '}') {
              openBrackets--;
              if (openBrackets === 0 && startIndex !== -1) {
                const objStr = buffer.substring(startIndex, i + 1);
                try {
                  const json = JSON.parse(objStr);
                  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (json.usageMetadata) {
                    promptTokens = json.usageMetadata.promptTokenCount || promptTokens;
                    completionTokens = json.usageMetadata.candidatesTokenCount || completionTokens;
                  }
                  yield { chunk: text, done: false };
                } catch (e: any) {
                  self.logger.warn(`Failed to parse Gemini stream chunk: ${e.message}`);
                }
                buffer = buffer.substring(i + 1);
                i = -1; // reset index scanner
                startIndex = -1;
              }
            }
          }
        }
        
        yield { chunk: '', done: true, usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        }};
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || error.message;
        self.logger.error(`Gemini stream error: ${msg}`);
        throw new Error(`Gemini stream failed: ${msg}`);
      }
    }
    return run();
  }

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; latency?: number }> {
    const start = Date.now();
    try {
      const apiKey = await this.getApiKey();
      await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { timeout: 5000 });
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      return { status: 'unhealthy', error: msg };
    }
  }

  async getSupportedModels(): Promise<string[]> {
    return [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ];
  }
}
