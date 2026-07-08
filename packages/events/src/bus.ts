import { CoreLogger } from '@aios/core';
import { AIOSEvent, AIOSEventType, EventBusListener } from './types';

export class CoreEventBus {
  private listeners: Map<AIOSEventType, Set<EventBusListener>> = new Map();
  private logger: CoreLogger;

  constructor(logger: CoreLogger) {
    this.logger = logger;
  }

  on(type: AIOSEventType, listener: EventBusListener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    this.logger.debug(`Listener added for event type: ${type}`);
  }

  off(type: AIOSEventType, listener: EventBusListener) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(listener);
      this.logger.debug(`Listener removed for event type: ${type}`);
    }
  }

  async emit<T>(type: AIOSEventType, payload: T): Promise<void> {
    const event: AIOSEvent<T> = {
      type,
      payload,
      timestamp: Date.now()
    };

    const typeListeners = this.listeners.get(type) || new Set();
    
    this.logger.debug(`Emitting event: ${type} to ${typeListeners.size} listeners`);

    for (const listener of typeListeners) {
      try {
        await Promise.resolve(listener(event));
      } catch (error: any) {
        this.logger.error(`Error in event listener for ${type}: ${error.message}`);
      }
    }
  }
}
