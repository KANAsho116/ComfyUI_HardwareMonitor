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
export declare class HardwareChartsUI {
    private chartManager;
    private panel;
    private enabled;
    private initialized;
    private chartDefs;
    private capacitiesInitialized;
    private capacities;
    private visibilitySettings;
    constructor();
    createDOM(): void;
    private makeDraggable;
    private initChartDefinitions;
    private isChartVisible;
    initializeCharts(gpuCount: number, visibilitySettings?: ChartVisibilitySettings): Promise<void>;
    setChartVisibility(category: keyof ChartVisibilitySettings, visible: boolean): void;
    updateAllCharts(data: TStatsData): void;
    private initializeCapacities;
    private updateSpeedScales;
    private updateChartTitle;
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    isInitialized(): boolean;
    destroy(): void;
}
