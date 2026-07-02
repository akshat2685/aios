export class RequestManager {
  // Lower number means higher priority. Default is 3. User interactions = 1.
  private queue: Array<{ priority: number, resolve: () => void }> = [];
  private activeCount: number = 0;
  private requestTimestamps: number[] = [];
  
  private readonly maxConcurrent: number;
  private readonly maxRpm: number;

  constructor(maxConcurrent: number = 2, maxRpm: number = 10) {
    this.maxConcurrent = maxConcurrent;
    this.maxRpm = maxRpm;
  }

  async enqueue<T>(operation: () => Promise<T>, priority: number = 3): Promise<T> {
    await this.waitForTurn(priority);
    
    this.activeCount++;
    this.requestTimestamps.push(Date.now());
    
    try {
      return await operation();
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  private async waitForTurn(priority: number): Promise<void> {
    while (true) {
      this.cleanOldTimestamps();
      
      const isUnderConcurrency = this.activeCount < this.maxConcurrent;
      const isUnderRpm = this.requestTimestamps.length < this.maxRpm;

      if (isUnderConcurrency && isUnderRpm) {
        return; // We can proceed immediately
      }

      // If we are blocked solely by RPM, we must set a timer to wake up the queue
      if (isUnderConcurrency && !isUnderRpm) {
        const oldestTimestamp = this.requestTimestamps[0];
        const timeUntilNextSlot = (oldestTimestamp + 60000) - Date.now();
        setTimeout(() => this.processNext(), Math.max(100, timeUntilNextSlot));
      }

      // Wait in the queue
      await new Promise<void>((resolve) => {
        this.queue.push({ priority, resolve });
        // Sort ascending so smallest priority number is at the front (highest priority)
        this.queue.sort((a, b) => a.priority - b.priority);
      });
    }
  }

  private processNext() {
    if (this.queue.length > 0) {
      // Wake up the next in line (highest priority) so it can evaluate conditions
      const next = this.queue.shift();
      if (next) next.resolve();
    }
  }

  private cleanOldTimestamps() {
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);
  }
}
