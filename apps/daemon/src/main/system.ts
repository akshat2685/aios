import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

export interface SystemMetrics {
  cpuUsage: number;
  totalMem: number;
  freeMem: number;
  uptime: number;
  platform: string;
}

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaProcessInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  expires_at: string;
  size_vram: number;
}

export class SystemMonitor {
  private static previousCpuUsage: NodeJS.CpuUsage;
  private static previousTime: number;

  public static getSystemMetrics(): SystemMetrics {
    // Basic CPU usage calculation for the current process
    // For entire system CPU, os.cpus() needs to be diffed over an interval.
    // As a simple approximation for the dashboard, we return the process CPU usage mapped to a 0-100 scale,
    // or calculate overall system CPU.
    
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    const usage = total === 0 ? 0 : 100 - ~~(100 * idle / total);

    return {
      cpuUsage: usage,
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      uptime: os.uptime(),
      platform: os.platform(),
    };
  }

  public static async getOllamaModels(baseUrl = 'http://localhost:11434'): Promise<OllamaModelInfo[]> {
    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data: any = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  public static async getOllamaPs(baseUrl = 'http://localhost:11434'): Promise<OllamaProcessInfo[]> {
    try {
      const res = await fetch(`${baseUrl}/api/ps`);
      if (!res.ok) return [];
      const data: any = await res.json();
      return data.models || [];
    } catch {
      return [];
    }
  }
}
