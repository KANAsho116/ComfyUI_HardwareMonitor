class DataBuffer {
    constructor() {
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "maxAge", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 60
        });
    }
    add(value) {
        const now = Date.now() / 1000;
        this.data.push({ time: now, value });
        const cutoff = now - this.maxAge;
        while (this.data.length > 0 && this.data[0].time < cutoff) {
            this.data.shift();
        }
    }
    getPoints() {
        return this.data;
    }
    getLatest() {
        if (this.data.length === 0)
            return undefined;
        return this.data[this.data.length - 1].value;
    }
    clear() {
        this.data = [];
    }
}
class LineChart {
    constructor(container, config) {
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "buffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "config", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "width", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "height", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        this.config = config;
        this.buffer = new DataBuffer();
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        container.appendChild(this.canvas);
        const ctx = this.canvas.getContext('2d');
        if (!ctx)
            throw new Error('Canvas 2D not supported');
        this.ctx = ctx;
        this.handleResize();
        const observer = new ResizeObserver(() => this.handleResize());
        observer.observe(container);
    }
    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.render();
    }
    addValue(value) {
        if (value < 0)
            return;
        this.buffer.add(value);
        this.render();
    }
    render() {
        const { ctx, width, height } = this;
        if (width <= 0 || height <= 0)
            return;
        const points = this.buffer.getPoints();
        const now = Date.now() / 1000;
        const timeWindow = 60;
        const timeStart = now - timeWindow;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
            const y = Math.floor(height * i / 4) + 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        const yMin = this.config.yMin ?? 0;
        let yMax = this.config.yMax;
        if (yMax === undefined) {
            let maxVal = 10;
            for (const p of points) {
                if (p.value > maxVal)
                    maxVal = p.value;
            }
            yMax = maxVal * 1.2;
        }
        const yRange = yMax - yMin;
        if (yRange <= 0)
            return;
        const screenPoints = [];
        for (const p of points) {
            if (p.time < timeStart)
                continue;
            const x = ((p.time - timeStart) / timeWindow) * width;
            const y = height - ((p.value - yMin) / yRange) * height;
            screenPoints.push({ x, y });
        }
        if (screenPoints.length >= 2) {
            const firstPoint = screenPoints[0];
            const lastPoint = screenPoints[screenPoints.length - 1];
            ctx.strokeStyle = this.config.color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(firstPoint.x, firstPoint.y);
            for (let i = 1; i < screenPoints.length; i++) {
                const pt = screenPoints[i];
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
            ctx.fillStyle = this.hexToRgba(this.config.color, 0.15);
            ctx.beginPath();
            ctx.moveTo(firstPoint.x, height);
            for (const p of screenPoints) {
                ctx.lineTo(p.x, p.y);
            }
            ctx.lineTo(lastPoint.x, height);
            ctx.closePath();
            ctx.fill();
        }
        else if (screenPoints.length === 1) {
            const pt = screenPoints[0];
            ctx.fillStyle = this.config.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(yMax.toFixed(0), 2, 2);
        ctx.textBaseline = 'bottom';
        ctx.fillText(yMin.toFixed(0), 2, height - 2);
    }
    hexToRgba(hex, alpha) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    getBuffer() {
        return this.buffer;
    }
    destroy() {
        this.canvas.remove();
    }
}
export class ChartManager {
    constructor() {
        Object.defineProperty(this, "charts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    createChart(config, container) {
        if (this.charts.has(config.id)) {
            this.charts.get(config.id).destroy();
        }
        const chart = new LineChart(container, config);
        this.charts.set(config.id, chart);
    }
    updateData(id, value) {
        const chart = this.charts.get(id);
        if (chart) {
            chart.addValue(value);
        }
    }
    getLatestValue(id) {
        const chart = this.charts.get(id);
        return chart?.getBuffer().getLatest();
    }
    clearBuffer(id) {
        const chart = this.charts.get(id);
        if (chart) {
            chart.getBuffer().clear();
        }
    }
    clearAllBuffers() {
        for (const chart of this.charts.values()) {
            chart.getBuffer().clear();
        }
    }
    destroyChart(id) {
        const chart = this.charts.get(id);
        if (chart) {
            chart.destroy();
            this.charts.delete(id);
        }
    }
    destroyAll() {
        for (const chart of this.charts.values()) {
            chart.destroy();
        }
        this.charts.clear();
    }
}
