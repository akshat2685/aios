import { TelemetryEngine } from './telemetry';

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: Map<string, { help: string; type: 'counter' | 'gauge' | 'histogram'; values: Map<string, number> }> = new Map();

  private constructor() {
    this.registerMetric('stt_latency_ms', 'Speech-to-text latency in milliseconds', 'histogram');
    this.registerMetric('tts_latency_ms', 'Text-to-speech latency in milliseconds', 'histogram');
    this.registerMetric('tool_execution_time_ms', 'Tool execution time in milliseconds', 'histogram');
    this.registerMetric('tool_errors_total', 'Total tool execution errors', 'counter');
    this.registerMetric('agent_calls_total', 'Total agent executions', 'counter');
    this.registerMetric('agent_latency_ms', 'Agent execution latency', 'histogram');
    this.registerMetric('cache_hit_ratio', 'Cache hit ratio', 'gauge');
    this.registerMetric('token_usage_total', 'Total input and output token count', 'counter');
    this.registerMetric('model_routing_decisions', 'LLM model routing count by model name', 'counter');
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  public registerMetric(name: string, help: string, type: 'counter' | 'gauge' | 'histogram'): void {
    this.metrics.set(name, { help, type, values: new Map() });
  }

  public increment(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const labelKey = this.serializeLabels(labels);
    const current = metric.values.get(labelKey) || 0;
    metric.values.set(labelKey, current + value);
  }

  public set(name: string, labels: Record<string, string>, value: number): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const labelKey = this.serializeLabels(labels);
    metric.values.set(labelKey, value);
  }

  public observe(name: string, labels: Record<string, string>, value: number): void {
    // Record histogram observations (simulated bucket updates for Prom compatibility)
    this.increment(name, { ...labels, le: this.getHistogramBucket(value) });
    this.increment(name + '_sum', labels, value);
    this.increment(name + '_count', labels, 1);
  }

  /**
   * Render metrics output in Prometheus exposition format.
   */
  public renderExposition(): string {
    let output = '';
    for (const [name, metric] of this.metrics) {
      output += `# HELP ${name} ${metric.help}\n`;
      output += `# TYPE ${name} ${metric.type}\n`;

      for (const [labelsStr, val] of metric.values) {
        output += `${name}${labelsStr} ${val}\n`;
      }
      output += '\n';
    }
    return output;
  }

  private serializeLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    const items = entries.map(([k, v]) => `${k}="${v}"`).join(',');
    return `{${items}}`;
  }

  private getHistogramBucket(value: number): string {
    if (value <= 100) return '100';
    if (value <= 250) return '250';
    if (value <= 500) return '500';
    if (value <= 1000) return '1000';
    if (value <= 2000) return '2000';
    return '+Inf';
  }
}
