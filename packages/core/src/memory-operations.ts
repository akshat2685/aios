import { IMemoryClient } from '@aios/types';
import { v4 as uuidv4 } from 'uuid';

export type MemoryType = 'preference' | 'note' | 'project' | 'person' | 'document' | 'conversation';

export class MemoryOperations {
  constructor(private client: IMemoryClient) {}

  async saveTypedMemory(type: MemoryType, content: string, metadata: Record<string, any> = {}): Promise<string> {
    const id = uuidv4();
    const record = {
      id,
      type,
      content,
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.client.add(record);
    return id;
  }

  async searchTyped(type: MemoryType, query: string, limit: number = 10): Promise<any[]> {
    return this.client.search({
      query,
      filter: {
        must: [
          {
            key: 'type',
            match: {
              value: type,
            },
          },
        ],
      },
      limit,
    });
  }

  async savePreference(key: string, value: string): Promise<string> {
    await this.client.deleteByMetadata('key', key);
    return this.saveTypedMemory('preference', value, { key });
  }

  async saveNote(topic: string, text: string): Promise<string> {
    return this.saveTypedMemory('note', text, { topic });
  }

  async saveProjectContext(projectId: string, text: string): Promise<string> {
    return this.saveTypedMemory('project', text, { projectId });
  }

  async savePersonInfo(name: string, info: string): Promise<string> {
    return this.saveTypedMemory('person', info, { name });
  }

  async getGlobalPreferences(): Promise<any[]> {
    return this.searchTyped('preference', 'user preferences', 50);
  }
}
