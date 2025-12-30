export interface ChartConfig {
    id: string;
    title: string;
    color: string;
    unit: string;
    yMin?: number;
    yMax?: number;
}
export declare class ChartManager {
    private charts;
    createChart(config: ChartConfig, container: HTMLElement): void;
    updateData(id: string, value: number): void;
    getLatestValue(id: string): number | undefined;
    clearBuffer(id: string): void;
    clearAllBuffers(): void;
    destroyChart(id: string): void;
    destroyAll(): void;
}
