import { ScheduledTask } from '../engine';

export function createGithubMonitor(): ScheduledTask {
  return {
    id: 'monitor.github',
    name: 'GitHub Activity Monitor',
    intervalMs: 1000 * 60 * 15, // 15 minutes
    execute: async () => {
      // Stub implementation: fetch notifications and create memory events
      console.log('Fetching GitHub notifications...');
    }
  };
}
