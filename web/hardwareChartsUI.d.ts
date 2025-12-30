export declare class HardwareChartsUI {
    private chartManager;
    private panel;
    private enabled;
    private initialized;
    private chartDefs;
    constructor();
    createDOM(): void;
    private makeDraggable;
    private initChartDefinitions;
    initializeCharts(gpuCount: number): Promise<void>;
    updateAllCharts(data: TStatsData): void;
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    isInitialized(): boolean;
    destroy(): void;
}
