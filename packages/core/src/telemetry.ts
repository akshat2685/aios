import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  type: 'request' | 'circuit' | 'cache' | 'error' | 'system';
  level: LogLevel;
  message: string;
  data?: any;
}

export interface LLMRequestEvent {
  provider: string;
  model: string;
  agent?: string;
  tokens_in: number;
  tokens_out: number;
  latency: number;
  status: number;
  requestPayload?: string;
  responsePayload?: string;
}

export class TelemetryEngine {
  private static instance: TelemetryEngine;
  private logsPath: string;
  private ringBuffer: TelemetryEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 1000; // Keep last 1000 logs in memory
  private logLevel: LogLevel = 'INFO';
  
  private levelWeights: Record<LogLevel, number> = {
    'TRACE': 0,
    'DEBUG': 1,
    'INFO': 2,
    'WARN': 3,
    'ERROR': 4,
  };

  private constructor() {
    let userDataPath: string;
    try {
      const { app } = require('electron');
      userDataPath = app.getPath('userData');
    } catch {
      userDataPath = path.join(os.homedir(), '.aios');
    }

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.logsPath = path.join(userDataPath, 'telemetry.log');
    
    // Rotate log if it exceeds 10MB
    try {
      if (fs.existsSync(this.logsPath)) {
        const stats = fs.statSync(this.logsPath);
        if (stats.size > 10 * 1024 * 1024) {
          fs.renameSync(this.logsPath, this.logsPath + '.old');
        }
      }
    } catch (e) {
      // ignore
    }
  }

  public static getInstance(): TelemetryEngine {
    if (!TelemetryEngine.instance) {
      TelemetryEngine.instance = new TelemetryEngine();
    }
    return TelemetryEngine.instance;
  }

  public setLevel(level: LogLevel) {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelWeights[level] >= this.levelWeights[this.logLevel];
  }

  private appendLog(type: TelemetryEvent['type'], level: LogLevel, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const event: TelemetryEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type,
      level,
      message,
      data
    };

    // Add to in-memory buffer
    this.ringBuffer.unshift(event);
    if (this.ringBuffer.length > this.MAX_BUFFER_SIZE) {
      this.ringBuffer.pop();
    }

    // Persist to file
    try {
      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(this.logsPath, line, 'utf8');
    } catch (e) {
      console.error('Telemetry write failed:', e);
    }
  }

  public logRequest(payload: LLMRequestEvent) {
    this.appendLog('request', 'INFO', `LLM Request to ${payload.provider}`, payload);
  }

  public logCircuit(message: string, data?: any) {
    this.appendLog('circuit', 'WARN', message, data);
  }

  public logCache(message: string, hit: boolean, data?: any) {
    this.appendLog('cache', 'DEBUG', message, { hit, ...data });
  }

  public logError(message: string, errorType: string, data?: any) {
    this.appendLog('error', 'ERROR', message, { errorType, ...data });
  }

  public logSystem(message: string, level: LogLevel = 'INFO', data?: any) {
    this.appendLog('system', level, message, data);
  }

  public getRecentEvents(limit: number = 100, type?: string): TelemetryEvent[] {
    let evs = this.ringBuffer;
    if (type) {
      evs = evs.filter(e => e.type === type);
    }
    return evs.slice(0, limit);
  }
  
  public clearLogs() {
    this.ringBuffer = [];
    try {
      if (fs.existsSync(this.logsPath)) {
        fs.unlinkSync(this.logsPath);
      }
    } catch (e) {}
  }
}
