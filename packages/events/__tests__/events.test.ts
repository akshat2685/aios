import { describe, it, expect, vi } from 'vitest';
import { CoreEventBus } from '../src/bus';
import * as index from '../src/index';

describe('events package', () => {
  it('should export CoreEventBus', () => {
    expect(index.CoreEventBus).toBeDefined();
  });
});

describe('CoreEventBus', () => {
  const mockLogger: any = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  it('should add listener and emit event', async () => {
    const bus = new CoreEventBus(mockLogger);
    const listener = vi.fn();
    
    bus.on('AgentTaskCompleted', listener);
    
    await bus.emit('AgentTaskCompleted', { taskId: 123 });
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'AgentTaskCompleted',
      payload: { taskId: 123 },
      timestamp: expect.any(Number)
    }));
    
    expect(mockLogger.debug).toHaveBeenCalledWith('Listener added for event type: AgentTaskCompleted');
    expect(mockLogger.debug).toHaveBeenCalledWith('Emitting event: AgentTaskCompleted to 1 listeners');
  });

  it('should remove listener', async () => {
    const bus = new CoreEventBus(mockLogger);
    const listener = vi.fn();
    
    bus.on('AgentTaskCompleted', listener);
    bus.off('AgentTaskCompleted', listener);
    
    await bus.emit('AgentTaskCompleted', { taskId: 123 });
    
    expect(listener).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith('Listener removed for event type: AgentTaskCompleted');
  });

  it('should not throw if off called with listener not added', () => {
    const bus = new CoreEventBus(mockLogger);
    const listener = vi.fn();
    bus.off('AgentTaskCompleted', listener);
  });

  it('should handle errors in listener', async () => {
    const bus = new CoreEventBus(mockLogger);
    const listener = vi.fn().mockImplementation(() => {
      throw new Error('Listener error');
    });
    
    bus.on('AgentTaskCompleted', listener);
    
    await bus.emit('AgentTaskCompleted', { taskId: 123 });
    
    expect(listener).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith('Error in event listener for AgentTaskCompleted: Listener error');
  });

  it('should handle multiple listeners for same event', async () => {
    const bus = new CoreEventBus(mockLogger);
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    bus.on('AgentTaskCompleted', listener1);
    bus.on('AgentTaskCompleted', listener2);
    
    await bus.emit('AgentTaskCompleted', { taskId: 123 });
    
    expect(listener1).toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });

  it('should handle async listeners properly', async () => {
    const bus = new CoreEventBus(mockLogger);
    let resolved = false;
    const listener = async () => {
      await new Promise(r => setTimeout(r, 10));
      resolved = true;
    };
    
    bus.on('AgentTaskCompleted', listener);
    
    await bus.emit('AgentTaskCompleted', { taskId: 123 });
    expect(resolved).toBe(true);
  });
  
  it('should do nothing if emitting event with no listeners', async () => {
    const bus = new CoreEventBus(mockLogger);
    await bus.emit('AgentTaskCompleted', { taskId: 123 });
    // Should simply log "Emitting event: AgentTaskCompleted to 0 listeners"
    expect(mockLogger.debug).toHaveBeenCalledWith('Emitting event: AgentTaskCompleted to 0 listeners');
  });
});
