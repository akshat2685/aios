import { GeminiProvider } from '../packages/llm/src/providers/gemini';
import { OllamaProvider } from '../packages/llm/src/providers/ollama';

async function main() {
  const mockLogger: any = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.log,
  };

  const mockSecurity: any = {
    getSecret: async (key: string) => {
      // Return the Gemini API key the user provided earlier
      if (key === 'gemini_api_key') return 'AQ.Ab8RN6JOn-LGq_sU0Y6mIsmOZ3su-xYsuhAiE9E4B4x6BqhcAQ';
      return null;
    }
  };

  console.log('--- Testing Gemini 2.5 Pro ---');
  try {
    const gemini = new GeminiProvider(mockSecurity, mockLogger);
    const gen = await gemini.stream({
      prompt: 'Hello! Just a short 5-word test.',
      model: 'gemini-2.5-pro'
    });
    for await (const chunk of gen) {
      process.stdout.write(chunk.chunk);
    }
    console.log('\n✅ Gemini Success');
  } catch (e: any) {
    console.error('❌ Gemini Error:', e.message);
  }

  console.log('\n--- Testing Ollama llama3.2:latest ---');
  try {
    const ollama = new OllamaProvider({ baseUrl: 'http://localhost:11434' }, mockLogger);
    const gen2 = await ollama.stream({
      prompt: 'Hello! Just a short 5-word test.',
      model: 'qwen2.5-coder:3b'
    });
    for await (const chunk of gen2) {
      process.stdout.write(chunk.chunk);
    }
    console.log('\n✅ Ollama Success');
  } catch (e: any) {
    console.error('❌ Ollama Error:', e.message);
  }
}

main().catch(console.error);
