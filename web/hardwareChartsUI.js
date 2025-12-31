import { ChartManager } from './chartManager.js';
import { Colors } from './styles.js';
export class HardwareChartsUI {
    constructor() {
        Object.defineProperty(this, "chartManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "panel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "enabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "chartDefs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "capacitiesInitialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "capacities", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                ramTotal: 0,
                vramTotal: [],
                sharedGpuMemoryTotal: 0,
                vramSpeedMax: 0,
                sharedSpeedMax: 0,
            }
        });
        Object.defineProperty(this, "visibilitySettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                cpu: true,
                ram: true,
                gpuUsage: true,
                gpuTemp: true,
                vram: true,
                vramSpeed: true,
                sharedGpuSpeed: true,
                sharedGpuMem: true,
            }
        });
        this.chartManager = new ChartManager();
    }
    createDOM() {
        if (this.panel)
            return;
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
        document.body.appendChild(this.panel);
        this.makeDraggable(this.panel, header);
    }
    makeDraggable(panel, handle) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startRight = 0;
        let startBottom = 0;
        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON')
                return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startRight = parseInt(panel.style.right) || 10;
            startBottom = parseInt(panel.style.bottom) || 10;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging)
                return;
            const dx = startX - e.clientX;
            const dy = startY - e.clientY;
            panel.style.right = Math.max(0, startRight + dx) + 'px';
            panel.style.bottom = Math.max(0, startBottom + dy) + 'px';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    initChartDefinitions(gpuCount) {
        this.chartDefs = [];
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
        for (let i = 0; i < gpuCount; i++) {
            const suffix = gpuCount > 1 ? ` ${i}` : '';
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
    isChartVisible(visibilityKey) {
        if (!visibilityKey)
            return true;
        return this.visibilitySettings[visibilityKey] ?? true;
    }
    async initializeCharts(gpuCount, visibilitySettings) {
        if (this.initialized)
            return;
        if (visibilitySettings) {
            this.visibilitySettings = { ...visibilitySettings };
        }
        this.initChartDefinitions(gpuCount);
        this.createDOM();
        const container = document.getElementById('crystools-charts-list');
        if (!container)
            return;
        container.innerHTML = '';
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
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 50));
        for (const def of this.chartDefs) {
            const chartContainer = document.getElementById(`crystools-chart-${def.id}`);
            if (chartContainer) {
                this.chartManager.createChart(def, chartContainer);
            }
        }
        this.initialized = true;
    }
    setChartVisibility(category, visible) {
        this.visibilitySettings[category] = visible;
        for (const def of this.chartDefs) {
            if (def.visibilityKey === category) {
                const chartItem = document.getElementById(`crystools-chart-item-${def.id}`);
                if (chartItem) {
                    chartItem.style.display = visible ? 'block' : 'none';
                }
            }
        }
    }
    updateAllCharts(data) {
        if (!this.enabled || !this.initialized)
            return;
        if (!this.capacitiesInitialized) {
            this.initializeCapacities(data);
        }
        for (const def of this.chartDefs) {
            const value = def.getValue(data);
            this.chartManager.updateData(def.id, value);
            const valueEl = document.getElementById(`crystools-val-${def.id}`);
            if (valueEl && value >= 0) {
                valueEl.textContent = def.formatValue(value);
            }
        }
        this.updateSpeedScales(data);
    }
    initializeCapacities(data) {
        if (data.ram_total && data.ram_total > 0) {
            this.capacities.ramTotal = data.ram_total;
            const ramGB = data.ram_total / (1024 * 1024 * 1024);
            this.chartManager.updateChartYMax('ram', ramGB);
            this.updateChartTitle('ram', `RAM (${ramGB.toFixed(0)} GB)`);
        }
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
        if (data.shared_gpu_memory_total && data.shared_gpu_memory_total > 0) {
            this.capacities.sharedGpuMemoryTotal = data.shared_gpu_memory_total;
            const sharedGB = data.shared_gpu_memory_total / (1024 * 1024 * 1024);
            this.chartManager.updateChartYMax('shared_mem_gb', sharedGB);
            this.updateChartTitle('shared_mem_gb', `Shared GPU (${sharedGB.toFixed(0)} GB)`);
        }
        this.capacitiesInitialized = true;
    }
    updateSpeedScales(data) {
        if (data.vram_transfer_speed && data.vram_transfer_speed > 0) {
            const speedGBs = data.vram_transfer_speed / 1024;
            if (speedGBs > this.capacities.vramSpeedMax) {
                this.capacities.vramSpeedMax = speedGBs * 1.2;
                this.chartManager.updateChartYMax('vram_speed', this.capacities.vramSpeedMax);
            }
        }
        if (data.shared_gpu_transfer_speed && data.shared_gpu_transfer_speed > 0) {
            const speedGBs = data.shared_gpu_transfer_speed / 1024;
            if (speedGBs > this.capacities.sharedSpeedMax) {
                this.capacities.sharedSpeedMax = speedGBs * 1.2;
                this.chartManager.updateChartYMax('shared_speed', this.capacities.sharedSpeedMax);
            }
        }
    }
    updateChartTitle(chartId, newTitle) {
        const chartItem = document.getElementById(`crystools-chart-${chartId}`)?.parentElement;
        if (chartItem) {
            const titleEl = chartItem.querySelector('span');
            if (titleEl) {
                titleEl.textContent = newTitle;
            }
        }
    }
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.panel) {
            this.panel.style.display = enabled ? 'block' : 'none';
        }
    }
    isEnabled() {
        return this.enabled;
    }
    isInitialized() {
        return this.initialized;
    }
    destroy() {
        this.chartManager.destroyAll();
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
        this.initialized = false;
        this.enabled = false;
    }
}
