/**
 * Chart Manager Module
 *
 * Simple time-series line chart implementation using Canvas 2D.
 * Designed for hardware monitoring visualization.
 */

/** Data point with timestamp and value */
interface DataPoint {
  time: number;
  value: number;
}

/** Chart configuration */
export interface ChartConfig {
  id: string;
  title: string;
  color: string;
  unit: string;
  yMin?: number;
  yMax?: number;
}

/**
 * Ring buffer for time-series data (60 seconds of history)
 */
class DataBuffer {
  private data: DataPoint[] = [];
  private maxAge: number = 60; // seconds

  add(value: number): void {
    const now = Date.now() / 1000;
    this.data.push({ time: now, value });

    // Remove old data (older than maxAge seconds)
    const cutoff = now - this.maxAge;
    while (this.data.length > 0 && this.data[0]!.time < cutoff) {
      this.data.shift();
    }
  }

  getPoints(): DataPoint[] {
    return this.data;
  }

  getLatest(): number | undefined {
    if (this.data.length === 0) return undefined;
    return this.data[this.data.length - 1]!.value;
  }

  clear(): void {
    this.data = [];
  }
}

/**
 * Single line chart using Canvas 2D
 */
class LineChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: DataBuffer;
  private config: ChartConfig;
  private width: number = 0;
  private height: number = 0;

  constructor(container: HTMLElement, config: ChartConfig) {
    this.config = config;
    this.buffer = new DataBuffer();

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;

    // Initial resize
    this.handleResize();

    // Watch for container size changes
    const observer = new ResizeObserver(() => this.handleResize());
    observer.observe(container);
  }

  private handleResize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.width = rect.width;
    this.height = rect.height;

    // Set actual canvas size (accounting for device pixel ratio)
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);

    // Scale context to match
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.render();
  }

  addValue(value: number): void {
    if (value < 0) return; // Skip invalid values
    this.buffer.add(value);
    this.render();
  }

  private render(): void {
    const { ctx, width, height } = this;
    if (width <= 0 || height <= 0) return;

    const points = this.buffer.getPoints();
    const now = Date.now() / 1000;
    const timeWindow = 60; // 60 seconds
    const timeStart = now - timeWindow;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines (25%, 50%, 75%)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = Math.floor(height * i / 4) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Calculate Y axis range
    const yMin = this.config.yMin ?? 0;
    let yMax = this.config.yMax;

    if (yMax === undefined) {
      // Auto-scale: find max value and add 20% headroom
      let maxVal = 10;
      for (const p of points) {
        if (p.value > maxVal) maxVal = p.value;
      }
      yMax = maxVal * 1.2;
    }

    const yRange = yMax - yMin;
    if (yRange <= 0) return;

    // Convert data points to screen coordinates
    const screenPoints: { x: number; y: number }[] = [];
    for (const p of points) {
      if (p.time < timeStart) continue;

      const x = ((p.time - timeStart) / timeWindow) * width;
      const y = height - ((p.value - yMin) / yRange) * height;
      screenPoints.push({ x, y });
    }

    // Draw line
    if (screenPoints.length >= 2) {
      const firstPoint = screenPoints[0]!;
      const lastPoint = screenPoints[screenPoints.length - 1]!;

      ctx.strokeStyle = this.config.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < screenPoints.length; i++) {
        const pt = screenPoints[i]!;
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Draw filled area under the line
      ctx.fillStyle = this.hexToRgba(this.config.color, 0.15);
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, height);
      for (const p of screenPoints) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(lastPoint.x, height);
      ctx.closePath();
      ctx.fill();
    } else if (screenPoints.length === 1) {
      // Single point - draw a dot
      const pt = screenPoints[0]!;
      ctx.fillStyle = this.config.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(yMax.toFixed(0), 2, 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(yMin.toFixed(0), 2, height - 2);
  }

  private hexToRgba(hex: string, alpha: number): string {
    // Remove # if present
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getBuffer(): DataBuffer {
    return this.buffer;
  }

  destroy(): void {
    this.canvas.remove();
  }
}

/**
 * Chart Manager - manages multiple line charts
 */
export class ChartManager {
  private charts: Map<string, LineChart> = new Map();

  createChart(config: ChartConfig, container: HTMLElement): void {
    // Remove existing chart with same ID
    if (this.charts.has(config.id)) {
      this.charts.get(config.id)!.destroy();
    }

    const chart = new LineChart(container, config);
    this.charts.set(config.id, chart);
  }

  updateData(id: string, value: number): void {
    const chart = this.charts.get(id);
    if (chart) {
      chart.addValue(value);
    }
  }

  getLatestValue(id: string): number | undefined {
    const chart = this.charts.get(id);
    return chart?.getBuffer().getLatest();
  }

  clearBuffer(id: string): void {
    const chart = this.charts.get(id);
    if (chart) {
      chart.getBuffer().clear();
    }
  }

  clearAllBuffers(): void {
    for (const chart of this.charts.values()) {
      chart.getBuffer().clear();
    }
  }

  destroyChart(id: string): void {
    const chart = this.charts.get(id);
    if (chart) {
      chart.destroy();
      this.charts.delete(id);
    }
  }

  destroyAll(): void {
    for (const chart of this.charts.values()) {
      chart.destroy();
    }
    this.charts.clear();
  }
}
