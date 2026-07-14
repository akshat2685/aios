import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { TelemetryEngine } from '../src/telemetry';

describe('TelemetryEngine', () => {
  let engine: TelemetryEngine;

  beforeEach(() => {
    // Reset singleton for testing
    // @ts-ignore
    TelemetryEngine.instance = undefined;
    engine = TelemetryEngine.getInstance();
    engine.clearLogs();
  });

  afterEach(() => {
    engine.clearLogs();
  });

  it('should implement singleton pattern', () => {
    const engine2 = TelemetryEngine.getInstance();
    expect(engine).toBe(engine2);
  });

  it('should log system event and add it to buffer', () => {
    engine.logSystem('test system event', 'INFO', { foo: 'bar' });
    const events = engine.getRecentEvents();
    expect(events.length).toBe(1);
    expect(events[0].message).toBe('test system event');
    expect(events[0].level).toBe('INFO');
    expect(events[0].type).toBe('system');
    expect(events[0].data).toEqual({ foo: 'bar' });
  });

  it('should ignore logs below configured level', () => {
    engine.setLevel('WARN');
    engine.logSystem('test info event', 'INFO'); // Should be ignored
    engine.logSystem('test warn event', 'WARN'); // Should be logged
    
    const events = engine.getRecentEvents();
    expect(events.length).toBe(1);
    expect(events[0].level).toBe('WARN');
  });

  it('should log LLM requests', () => {
    engine.logRequest({
      provider: 'openai',
      model: 'gpt-4',
      tokens_in: 10,
      tokens_out: 20,
      latency: 100,
      status: 200
    });
    
    const events = engine.getRecentEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('request');
    expect(events[0].data.provider).toBe('openai');
  });

  it('should log circuit events', () => {
    engine.logCircuit('circuit open');
    const events = engine.getRecentEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('circuit');
    expect(events[0].level).toBe('WARN');
  });

  it('should log cache events', () => {
    engine.logCache('cache check', true);
    // Note: Default level is INFO, logCache uses DEBUG, so it will be ignored unless level is set
    engine.setLevel('DEBUG');
    engine.logCache('cache check 2', true);
    
    const events = engine.getRecentEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('cache');
    expect(events[0].level).toBe('DEBUG');
    expect(events[0].data.hit).toBe(true);
  });

  it('should log error events', () => {
    engine.logError('something went wrong', 'NetworkError');
    const events = engine.getRecentEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('error');
    expect(events[0].level).toBe('ERROR');
    expect(events[0].data.errorType).toBe('NetworkError');
  });

  it('should limit buffer size to MAX_BUFFER_SIZE', () => {
    for (let i = 0; i < 1005; i++) {
      engine.logSystem(`event ${i}`);
    }
    const events = engine.getRecentEvents(2000); // Try to get more than max
    expect(events.length).toBe(1000);
    expect(events[0].message).toBe('event 1004'); // Most recent first
  });

  it('should filter events by type', () => {
    engine.logSystem('system event');
    engine.logCircuit('circuit event');
    
    const circuitEvents = engine.getRecentEvents(100, 'circuit');
    expect(circuitEvents.length).toBe(1);
    expect(circuitEvents[0].type).toBe('circuit');
  });
});
