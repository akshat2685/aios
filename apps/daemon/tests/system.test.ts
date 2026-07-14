import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import { SystemMonitor } from '../src/main/system';

vi.mock('os', () => ({
  cpus: vi.fn(),
  totalmem: vi.fn(),
  freemem: vi.fn(),
  uptime: vi.fn(),
  platform: vi.fn()
}));

describe('SystemMonitor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should calculate system metrics correctly', () => {
    const mockCpus = [
      { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } },
      { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }
    ];
    // @ts-ignore
    os.cpus.mockReturnValue(mockCpus);
    // @ts-ignore
    os.totalmem.mockReturnValue(16000000000);
    // @ts-ignore
    os.freemem.mockReturnValue(8000000000);
    // @ts-ignore
    os.uptime.mockReturnValue(3600);
    // @ts-ignore
    os.platform.mockReturnValue('linux');

    const metrics = SystemMonitor.getSystemMetrics();

    expect(metrics.totalMem).toBe(16000000000);
    expect(metrics.freeMem).toBe(8000000000);
    expect(metrics.uptime).toBe(3600);
    expect(metrics.platform).toBe('linux');
    expect(metrics.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(metrics.cpuUsage).toBeLessThanOrEqual(100);
  });

  it('should return Ollama models on success', async () => {
    const mockModels = [{ name: 'llama2' }, { name: 'mistral' }];
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ models: mockModels })
    });

    const models = await SystemMonitor.getOllamaModels();
    expect(models).toEqual(mockModels);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
  });

  it('should return empty array when Ollama models fetch fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    
    const models = await SystemMonitor.getOllamaModels();
    expect(models).toEqual([]);
  });

  it('should return empty array when Ollama models fetch is not ok', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false });
    
    const models = await SystemMonitor.getOllamaModels();
    expect(models).toEqual([]);
  });

  it('should return Ollama process info on success', async () => {
    const mockPs = [{ name: 'llama2', size_vram: 4000000000 }];
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ models: mockPs })
    });

    const ps = await SystemMonitor.getOllamaPs();
    expect(ps).toEqual(mockPs);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/ps');
  });

  it('should return empty array when Ollama ps fetch fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    
    const ps = await SystemMonitor.getOllamaPs();
    expect(ps).toEqual([]);
  });
  it('should handle total tick being 0 (all cpus times are 0)', () => {
    const mockCpus = [
      { times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } },
    ];
    // @ts-ignore
    os.cpus.mockReturnValue(mockCpus);
    const metrics = SystemMonitor.getSystemMetrics();
    expect(metrics.cpuUsage).toBe(0);
  });

  it('should return empty array when models missing in data for getOllamaModels', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    const models = await SystemMonitor.getOllamaModels();
    expect(models).toEqual([]);
  });

  it('should return empty array when Ollama ps fetch is not ok', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false });
    const ps = await SystemMonitor.getOllamaPs();
    expect(ps).toEqual([]);
  });

  it('should return empty array when models missing in data for getOllamaPs', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({})
    });
    const ps = await SystemMonitor.getOllamaPs();
    expect(ps).toEqual([]);
  });
});
