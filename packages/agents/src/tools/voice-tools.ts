import { ToolDefinition } from '@aios/types';
import { LocalTTS, VoiceRecorder } from '@aios/offline-ai';

/**
 * Factory to construct voice tools.
 */
export function getVoiceTools(tts: LocalTTS, recorder: VoiceRecorder): ToolDefinition[] {
  return [
    {
      id: 'voice:speak',
      name: 'voice:speak',
      version: '1.0.0',
      description: 'Convert text to speech and play it to the user',
      category: 'voice',
      inputSchema: {
        required: ['text'],
        properties: {
          text: { type: 'string' },
          speed: { type: 'number', default: 1.0 }
        }
      },
      outputSchema: {
        properties: {
          played: { type: 'boolean' },
          durationMs: { type: 'number' }
        }
      },
      timeout: 10000,
      maxRetries: 2,
      requires_approval: false,
      parallel_safe: false,
      executor: async (input: { text: string; speed?: number }) => {
        const res = await tts.synthesize({
          text: input.text,
          speed: input.speed || 1.0
        });
        // Playback buffer triggers here
        return { played: true, durationMs: res.durationMs };
      }
    },

    {
      id: 'voice:listen',
      name: 'voice:listen',
      version: '1.0.0',
      description: 'Trigger microphone recording session for voice commands',
      category: 'voice',
      inputSchema: {
        properties: {
          durationMs: { type: 'number', default: 5000 }
        }
      },
      outputSchema: {
        properties: {
          success: { type: 'boolean' }
        }
      },
      timeout: 15000,
      maxRetries: 1,
      requires_approval: false,
      parallel_safe: false,
      executor: async (input: { durationMs?: number }) => {
        recorder.start();
        await new Promise(resolve => setTimeout(resolve, input.durationMs || 5000));
        recorder.stop();
        return { success: true };
      }
    }
  ];
}
