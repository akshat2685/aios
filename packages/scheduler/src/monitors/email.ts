import { ScheduledTask } from '../engine';

export function createEmailMonitor(): ScheduledTask {
  return {
    id: 'monitor.email',
    name: 'Email Activity Monitor',
    intervalMs: 1000 * 60 * 30, // 30 minutes
    execute: async () => {
      // Stub implementation: check unread emails and summarize
      console.log('Fetching unread emails...');
    }
  };
}
