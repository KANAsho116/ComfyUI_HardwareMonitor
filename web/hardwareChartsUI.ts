/**
 * Hardware Charts UI Module
 *
 * Creates a floating panel with time-series charts for hardware monitoring.
 * The panel is positioned in the bottom-right corner of the screen.
 */

import { ChartManager, ChartConfig } from './chartManager.js';
import { Colors } from './styles.js';

/** Chart definition with data extraction function */
interface ChartDefinition extends ChartConfig {
  getValue: (data: TStatsData) => number;
  formatValue: (value: number) => string;
  visibilityKey?: string;  // Key to check visibility settings
}

/** Chart visibility settings type */
export type ChartVisibilitySettings = {
  cpu: boolean;
  ram: boolean;
  gpuUsage: boolean;
  gpuTemp: boolean;
  vram: boolean;
  vramSpeed: boolean;
  sharedGpuSpeed: boolean;
  sharedGpuMem: boolean;
};

/** Hardware capacity information */
interface HardwareCapacities {
  ramTotal: number;  // bytes
  vramTotal: number[];  // bytes per GPU
  sharedGpuMemoryTotal: number;  // bytes
  vramSpeedMax: number;  // MB/s
  sharedSpeedMax: number;  // MB/s
}

/**
 * Hardware Charts UI - Floating Panel
 */
export class HardwareChartsUI {
  private chartManager: ChartManager;
  private panel: HTMLDivElement | null = null;
  private enabled: boolean = false;
  private initialized: boolean = false;
  private chartDefs: ChartDefinition[] = [];
  private capacitiesInitialized: boolean = false;
  private capacities: HardwareCapacities = {
    ramTotal: 0,
    vramTotal: [],
    sharedGpuMemoryTotal: 0,
    vramSpeedMax: 0,
    sharedSpeedMax: 0,
  };
  private visibilitySettings: ChartVisibilitySettings = {
    cpu: true,
    ram: true,
    gpuUsage: true,
    gpuTemp: true,
    vram: true,
    vramSpeed: true,
    sharedGpuSpeed: true,
    sharedGpuMem: true,
  };

  constructor() {
    this.chartManager = new ChartManager();
  }

  /**
   * Create the floating panel DOM structure
   */
  createDOM(): void {
    if (this.panel) return;

    // Create floating panel
    this.panel = document.createElement('div');
    this.panel.id = 'crystools-charts-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 520px;
      max-height: 90vh;
      background: rgba(30, 30, 30, 0.95);
      border: 1px solid #444;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      z-index: 1000;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 8px 12px;
      background: rgba(50, 50, 50, 0.9);
      border-bottom: 1px solid #444;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
    `;
    header.innerHTML = '<span style="font-size: 12px; font-weight: 600; color: #ddd;">Hardware Monitor</span>';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #888;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    `;
    closeBtn.onclick = () => this.setEnabled(false);
    header.appendChild(closeBtn);

    this.panel.appendChild(header);

    // Create charts container with 2-column grid
    const container = document.createElement('div');
    container.id = 'crystools-charts-list';
    container.style.cssText = `
      padding: 8px;
      overflow-y: auto;
      max-height: calc(90vh - 40px);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    `;
    this.panel.appendChild(container);

    // Add to document
    document.body.appendChild(this.panel);

    // Make panel draggable
    this.makeDraggable(this.panel, header);
  }

  /**
   * Make the panel draggable by its header
   */
  private makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(panel.style.right) || 10;
      startBottom = parseInt(panel.style.bottom) || 10;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      panel.style.right = Math.max(0, startRight + dx) + 'px';
      panel.style.bottom = Math.max(0, startBottom + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  /**
   * Initialize chart definitions based on GPU count
   */
  private initChartDefinitions(gpuCount: number): void {
    this.chartDefs = [];

    // CPU Usage
    this.chartDefs.push({
      id: 'cpu',
      title: 'CPU Usage',
      color: Colors.CPU,
      unit: '%',
      yMin: 0,
      yMax: 100,
      getValue: (data) => data.cpu_utilization,
      formatValue: (v) => `${v.toFixed(0)}%`,
      visibilityKey: 'cpu',
    });

    // RAM Usage
    this.chartDefs.push({
      id: 'ram',
      title: 'RAM Usage',
      color: Colors.RAM,
      unit: 'GB',
      getValue: (data) => {
        const used = data.ram_used ?? -1;
        return used > 0 ? used / (1024 * 1024 * 1024) : -1;
      },
      formatValue: (v) => `${v.toFixed(1)} GB`,
      visibilityKey: 'ram',
    });

    // GPU-specific charts
    for (let i = 0; i < gpuCount; i++) {
      const suffix = gpuCount > 1 ? ` ${i}` : '';

      // GPU Usage
      this.chartDefs.push({
        id: `gpu_${i}`,
        title: `GPU${suffix} Usage`,
        color: Colors.GPU,
        unit: '%',
        yMin: 0,
        yMax: 100,
        getValue: (data) => data.gpus?.[i]?.gpu_utilization ?? -1,
        formatValue: (v) => `${v.toFixed(0)}%`,
        visibilityKey: 'gpuUsage',
      });

      // GPU Temperature
      this.chartDefs.push({
        id: `temp_${i}`,
        title: `GPU${suffix} Temp`,
        color: Colors.TEMP_END,
        unit: '°C',
        yMin: 0,
        yMax: 100,
        getValue: (data) => data.gpus?.[i]?.gpu_temperature ?? -1,
        formatValue: (v) => `${v.toFixed(0)}°C`,
        visibilityKey: 'gpuTemp',
      });

      // VRAM Usage %
      this.chartDefs.push({
        id: `vram_${i}`,
        title: `VRAM${suffix} Usage`,
        color: Colors.VRAM,
        unit: '%',
        yMin: 0,
        yMax: 100,
        getValue: (data) => data.gpus?.[i]?.vram_used_percent ?? -1,
        formatValue: (v) => `${v.toFixed(0)}%`,
        visibilityKey: 'vram',
      });

      // VRAM Used GB
      this.chartDefs.push({
        id: `vram_gb_${i}`,
        title: `VRAM${suffix} Used`,
        color: Colors.VRAM,
        unit: 'GB',
        getValue: (data) => {
          const used = data.gpus?.[i]?.vram_used ?? -1;
          return used > 0 ? used / (1024 * 1024 * 1024) : -1;
        },
        formatValue: (v) => `${v.toFixed(1)} GB`,
        visibilityKey: 'vram',
      });
    }

    // VRAM Transfer Speed
    this.chartDefs.push({
      id: 'vram_speed',
      title: 'VRAM Speed',
      color: Colors.VRAM_SPEED,
      unit: 'GB/s',
      getValue: (data) => {
        const speed = data.vram_transfer_speed ?? -1;
        return speed > 0 ? speed / 1024 : -1;
      },
      formatValue: (v) => `${v.toFixed(1)} GB/s`,
      visibilityKey: 'vramSpeed',
    });

    // Shared GPU Memory Transfer Speed
    this.chartDefs.push({
      id: 'shared_speed',
      title: 'Shared GPU Speed',
      color: Colors.SHARED_GPU_SPEED,
      unit: 'GB/s',
      getValue: (data) => {
        const speed = data.shared_gpu_transfer_speed ?? -1;
        return speed > 0 ? speed / 1024 : -1;
      },
      formatValue: (v) => `${v.toFixed(1)} GB/s`,
      visibilityKey: 'sharedGpuSpeed',
    });

    // Shared GPU Memory Usage %
    this.chartDefs.push({
      id: 'shared_mem',
      title: 'Shared GPU Usage',
      color: Colors.SHARED_GPU_MEM,
      unit: '%',
      yMin: 0,
      yMax: 100,
      getValue: (data) => data.shared_gpu_memory_percent ?? -1,
      formatValue: (v) => `${v.toFixed(1)}%`,
      visibilityKey: 'sharedGpuMem',
    });

    // Shared GPU Memory Used GB
    this.chartDefs.push({
      id: 'shared_mem_gb',
      title: 'Shared GPU Used',
      color: Colors.SHARED_GPU_MEM,
      unit: 'GB',
      getValue: (data) => {
        const used = data.shared_gpu_memory_used ?? -1;
        return used > 0 ? used / (1024 * 1024 * 1024) : -1;
      },
      formatValue: (v) => `${v.toFixed(2)} GB`,
      visibilityKey: 'sharedGpuMem',
    });
  }

  /**
   * Check if a chart should be visible based on its visibility key
   */
  private isChartVisible(visibilityKey?: string): boolean {
    if (!visibilityKey) return true;
    return this.visibilitySettings[visibilityKey as keyof ChartVisibilitySettings] ?? true;
  }

  /**
   * Initialize charts with GPU count and visibility settings
   */
  async initializeCharts(gpuCount: number, visibilitySettings?: ChartVisibilitySettings): Promise<void> {
    if (this.initialized) return;

    // Apply visibility settings if provided
    if (visibilitySettings) {
      this.visibilitySettings = { ...visibilitySettings };
    }

    this.initChartDefinitions(gpuCount);

    // Ensure panel exists
    this.createDOM();

    const container = document.getElementById('crystools-charts-list');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    // Create chart items
    for (const def of this.chartDefs) {
      const isVisible = this.isChartVisible(def.visibilityKey);

      const item = document.createElement('div');
      item.className = 'crystools-chart-item';
      item.id = `crystools-chart-item-${def.id}`;
      item.style.cssText = `
        background: rgba(40, 40, 40, 0.8);
        border-radius: 6px;
        padding: 6px 8px;
        display: ${isVisible ? 'block' : 'none'};
      `;

      // Header with title and value
      const header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      `;

      const title = document.createElement('span');
      title.style.cssText = `
        font-size: 10px;
        font-weight: 500;
        color: #aaa;
      `;
      title.textContent = def.title;

      const value = document.createElement('span');
      value.id = `crystools-val-${def.id}`;
      value.style.cssText = `
        font-size: 11px;
        font-weight: 600;
        color: #fff;
        font-family: 'Consolas', 'Monaco', monospace;
      `;
      value.textContent = '--';

      header.appendChild(title);
      header.appendChild(value);
      item.appendChild(header);

      // Chart canvas container
      const chartContainer = document.createElement('div');
      chartContainer.id = `crystools-chart-${def.id}`;
      chartContainer.style.cssText = `
        width: 100%;
        height: 40px;
        border-radius: 4px;
        overflow: hidden;
      `;
      item.appendChild(chartContainer);

      container.appendChild(item);
    }

    // Wait for DOM to render
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 50));

    // Create charts
    for (const def of this.chartDefs) {
      const chartContainer = document.getElementById(`crystools-chart-${def.id}`);
      if (chartContainer) {
        this.chartManager.createChart(def, chartContainer);
      }
    }

    this.initialized = true;
  }

  /**
   * Set visibility for a specific chart category
   */
  setChartVisibility(category: keyof ChartVisibilitySettings, visible: boolean): void {
    this.visibilitySettings[category] = visible;

    // Update DOM visibility for all charts with this visibility key
    for (const def of this.chartDefs) {
      if (def.visibilityKey === category) {
        const chartItem = document.getElementById(`crystools-chart-item-${def.id}`);
        if (chartItem) {
          chartItem.style.display = visible ? 'block' : 'none';
        }
      }
    }
  }

  /**
   * Update all charts with new data
   */
  updateAllCharts(data: TStatsData): void {
    if (!this.enabled || !this.initialized) return;

    // Initialize capacities on first data received
    if (!this.capacitiesInitialized) {
      this.initializeCapacities(data);
    }

    for (const def of this.chartDefs) {
      const value = def.getValue(data);

      // Update chart data
      this.chartManager.updateData(def.id, value);

      // Update value display
      const valueEl = document.getElementById(`crystools-val-${def.id}`);
      if (valueEl && value >= 0) {
        valueEl.textContent = def.formatValue(value);
      }
    }

    // Update dynamic speed scales
    this.updateSpeedScales(data);
  }

  /**
   * Initialize hardware capacities from first data
   */
  private initializeCapacities(data: TStatsData): void {
    // RAM total
    if (data.ram_total && data.ram_total > 0) {
      this.capacities.ramTotal = data.ram_total;
      const ramGB = data.ram_total / (1024 * 1024 * 1024);
      this.chartManager.updateChartYMax('ram', ramGB);
      this.updateChartTitle('ram', `RAM (${ramGB.toFixed(0)} GB)`);
    }

    // VRAM total per GPU
    if (data.gpus && Array.isArray(data.gpus)) {
      for (let i = 0; i < data.gpus.length; i++) {
        const gpu = data.gpus[i];
        if (gpu?.vram_total && gpu.vram_total > 0) {
          this.capacities.vramTotal[i] = gpu.vram_total;
          const vramGB = gpu.vram_total / (1024 * 1024 * 1024);
          this.chartManager.updateChartYMax(`vram_gb_${i}`, vramGB);
          const suffix = data.gpus.length > 1 ? ` ${i}` : '';
          this.updateChartTitle(`vram_gb_${i}`, `VRAM${suffix} (${vramGB.toFixed(0)} GB)`);
        }
      }
    }

    // Shared GPU Memory total
    if (data.shared_gpu_memory_total && data.shared_gpu_memory_total > 0) {
      this.capacities.sharedGpuMemoryTotal = data.shared_gpu_memory_total;
      const sharedGB = data.shared_gpu_memory_total / (1024 * 1024 * 1024);
      this.chartManager.updateChartYMax('shared_mem_gb', sharedGB);
      this.updateChartTitle('shared_mem_gb', `Shared GPU (${sharedGB.toFixed(0)} GB)`);
    }

    this.capacitiesInitialized = true;
  }

  /**
   * Update speed chart scales dynamically based on measured speeds
   */
  private updateSpeedScales(data: TStatsData): void {
    // VRAM speed - update max if current exceeds
    if (data.vram_transfer_speed && data.vram_transfer_speed > 0) {
      const speedGBs = data.vram_transfer_speed / 1024;
      if (speedGBs > this.capacities.vramSpeedMax) {
        this.capacities.vramSpeedMax = speedGBs * 1.2; // 20% headroom
        this.chartManager.updateChartYMax('vram_speed', this.capacities.vramSpeedMax);
      }
    }

    // Shared GPU speed - update max if current exceeds
    if (data.shared_gpu_transfer_speed && data.shared_gpu_transfer_speed > 0) {
      const speedGBs = data.shared_gpu_transfer_speed / 1024;
      if (speedGBs > this.capacities.sharedSpeedMax) {
        this.capacities.sharedSpeedMax = speedGBs * 1.2; // 20% headroom
        this.chartManager.updateChartYMax('shared_speed', this.capacities.sharedSpeedMax);
      }
    }
  }

  /**
   * Update chart title element
   */
  private updateChartTitle(chartId: string, newTitle: string): void {
    const chartItem = document.getElementById(`crystools-chart-${chartId}`)?.parentElement;
    if (chartItem) {
      const titleEl = chartItem.querySelector('span');
      if (titleEl) {
        titleEl.textContent = newTitle;
      }
    }
  }

  /**
   * Enable or disable the charts panel
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.panel) {
      this.panel.style.display = enabled ? 'block' : 'none';
    }
  }

  /**
   * Check if charts are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if charts are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Destroy the charts panel
   */
  destroy(): void {
    this.chartManager.destroyAll();
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.initialized = false;
    this.enabled = false;
  }
}
