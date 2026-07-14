import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../src/metrics';

describe('MetricsCollector', () => {
  beforeEach(() => {
    // @ts-ignore
    MetricsCollector.instance = undefined;
  });

  it('should be a singleton', () => {
    const instance1 = MetricsCollector.getInstance();
    const instance2 = MetricsCollector.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should register and increment a counter', () => {
    const metrics = MetricsCollector.getInstance();
    metrics.registerMetric('test_counter', 'A test counter', 'counter');
    metrics.increment('test_counter', { label: 'val' }, 1);
    metrics.increment('test_counter', { label: 'val' }, 2);
    
    const output = metrics.renderExposition();
    expect(output).toContain('# HELP test_counter A test counter');
    expect(output).toContain('# TYPE test_counter counter');
    expect(output).toContain('test_counter{label="val"} 3');
  });

  it('should set a gauge', () => {
    const metrics = MetricsCollector.getInstance();
    metrics.registerMetric('test_gauge', 'A test gauge', 'gauge');
    metrics.set('test_gauge', { env: 'prod' }, 50);
    metrics.set('test_gauge', { env: 'prod' }, 100);

    const output = metrics.renderExposition();
    expect(output).toContain('test_gauge{env="prod"} 100');
  });

  it('should observe histogram values across buckets', () => {
    const metrics = MetricsCollector.getInstance();
    metrics.registerMetric('test_hist', 'A test histogram', 'histogram');
    
    metrics.observe('test_hist', { path: '/' }, 150);
    metrics.observe('test_hist', { path: '/' }, 600);

    const output = metrics.renderExposition();
    
    expect(output).toContain('test_hist_bucket{path="/",le="250"} 1');
    expect(output).toContain('test_hist_bucket{path="/",le="500"} 1');
    expect(output).toContain('test_hist_bucket{path="/",le="1000"} 2');
    expect(output).toContain('test_hist_bucket{path="/",le="2000"} 2');
    expect(output).toContain('test_hist_bucket{path="/",le="+Inf"} 2');
    
    expect(output).toContain('test_hist_sum{path="/"} 750');
    expect(output).toContain('test_hist_count{path="/"} 2');
  });
});
