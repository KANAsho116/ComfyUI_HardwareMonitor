import { app, api, ComfyButtonGroup } from './comfy/index.js';
import { MonitorUI } from './monitorUI.js';
import { HardwareChartsUI } from './hardwareChartsUI.js';
import { Colors } from './styles.js';
import { ComfyKeyMenuDisplayOption, MenuDisplayOptions } from './progressBarUIBase.js';
class HardwareMonitor {
    constructor() {
        Object.defineProperty(this, "idExtensionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'HardwareMonitor'
        });
        Object.defineProperty(this, "menuDisplayOption", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: MenuDisplayOptions.Disabled
        });
        Object.defineProperty(this, "crystoolsButtonGroup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "settingsRate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "monitorUI", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "hardwareChartsUI", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsHardwareCharts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsTransferSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowCPU", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowRAM", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowGPUUsage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowGPUTemp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowVRAM", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowVRAMSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowSharedGPUSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "settingsShowSharedGPUMem", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "createSettingsRate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.settingsRate = {
                    id: 'HardwareMonitor.RefreshRate',
                    name: 'HardwareMonitor: Refresh Rate (seconds)',
                    tooltip: 'Update interval in seconds. Set to 0 to disable.',
                    type: 'slider',
                    attrs: {
                        min: 0,
                        max: 2,
                        step: .25,
                    },
                    defaultValue: .5,
                    onChange: async (value) => {
                        let valueNumber;
                        try {
                            valueNumber = parseFloat(value);
                            if (isNaN(valueNumber)) {
                                throw new Error('invalid value');
                            }
                        }
                        catch (error) {
                            console.error(error);
                            return;
                        }
                        try {
                            await this.updateServer({ rate: valueNumber });
                        }
                        catch (error) {
                            console.error(error);
                            return;
                        }
                    },
                };
            }
        });
        Object.defineProperty(this, "createSettingsHardwareCharts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.settingsHardwareCharts = {
                    id: 'HardwareMonitor.ShowChartsPanel',
                    name: 'HardwareMonitor: Show Charts Panel',
                    type: 'boolean',
                    label: 'Charts',
                    symbol: '',
                    tooltip: 'Display floating panel with hardware usage charts',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: '#4CAF50',
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setEnabled(value);
                    },
                };
            }
        });
        Object.defineProperty(this, "createSettingsTransferSpeed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.settingsTransferSpeed = {
                    id: 'HardwareMonitor.TransferSpeed',
                    name: 'HardwareMonitor: Transfer Speed Monitoring',
                    type: 'boolean',
                    label: 'Speed',
                    symbol: 'GB/s',
                    tooltip: 'Monitor VRAM and Shared GPU Memory transfer speeds',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.VRAM_SPEED,
                    onChange: async (value) => {
                        await this.updateServer({ switchTransferSpeed: value });
                    },
                };
            }
        });
        Object.defineProperty(this, "createChartVisibilitySettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.settingsShowCPU = {
                    id: 'HardwareMonitor.ShowCPU',
                    name: 'HardwareMonitor: Chart CPU',
                    type: 'boolean',
                    label: 'CPU',
                    symbol: '',
                    tooltip: 'Show/hide CPU usage chart',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.CPU,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('cpu', value);
                    },
                };
                this.settingsShowRAM = {
                    id: 'HardwareMonitor.ShowRAM',
                    name: 'HardwareMonitor: Chart RAM',
                    type: 'boolean',
                    label: 'RAM',
                    symbol: '',
                    tooltip: 'Show/hide RAM usage chart',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.RAM,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('ram', value);
                    },
                };
                this.settingsShowGPUUsage = {
                    id: 'HardwareMonitor.ShowGPUUsage',
                    name: 'HardwareMonitor: Chart GPU Usage',
                    type: 'boolean',
                    label: 'GPU Usage',
                    symbol: '',
                    tooltip: 'Show/hide GPU usage chart',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.GPU,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('gpuUsage', value);
                    },
                };
                this.settingsShowGPUTemp = {
                    id: 'HardwareMonitor.ShowGPUTemp',
                    name: 'HardwareMonitor: Chart GPU Temperature',
                    type: 'boolean',
                    label: 'GPU Temp',
                    symbol: '',
                    tooltip: 'Show/hide GPU temperature chart',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.TEMP_END,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('gpuTemp', value);
                    },
                };
                this.settingsShowVRAM = {
                    id: 'HardwareMonitor.ShowVRAM',
                    name: 'HardwareMonitor: Chart VRAM',
                    type: 'boolean',
                    label: 'VRAM',
                    symbol: '',
                    tooltip: 'Show/hide VRAM usage and used charts',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.VRAM,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('vram', value);
                    },
                };
                this.settingsShowVRAMSpeed = {
                    id: 'HardwareMonitor.ShowVRAMSpeed',
                    name: 'HardwareMonitor: Chart VRAM Speed',
                    type: 'boolean',
                    label: 'VRAM Speed',
                    symbol: '',
                    tooltip: 'Show/hide VRAM transfer speed chart',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.VRAM_SPEED,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('vramSpeed', value);
                    },
                };
                this.settingsShowSharedGPUSpeed = {
                    id: 'HardwareMonitor.ShowSharedGPUSpeed',
                    name: 'HardwareMonitor: Chart Shared GPU Speed',
                    type: 'boolean',
                    label: 'Shared GPU Speed',
                    symbol: '',
                    tooltip: 'Show/hide shared GPU memory transfer speed chart',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.SHARED_GPU_SPEED,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('sharedGpuSpeed', value);
                    },
                };
                this.settingsShowSharedGPUMem = {
                    id: 'HardwareMonitor.ShowSharedGPUMem',
                    name: 'HardwareMonitor: Chart Shared GPU Memory',
                    type: 'boolean',
                    label: 'Shared GPU Mem',
                    symbol: '',
                    tooltip: 'Show/hide shared GPU memory usage charts',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.SHARED_GPU_MEM,
                    onChange: async (value) => {
                        this.hardwareChartsUI?.setChartVisibility('sharedGpuMem', value);
                    },
                };
            }
        });
        Object.defineProperty(this, "getChartVisibilitySettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                return {
                    cpu: app.extensionManager.setting.get(this.settingsShowCPU.id) ?? true,
                    ram: app.extensionManager.setting.get(this.settingsShowRAM.id) ?? true,
                    gpuUsage: app.extensionManager.setting.get(this.settingsShowGPUUsage.id) ?? true,
                    gpuTemp: app.extensionManager.setting.get(this.settingsShowGPUTemp.id) ?? true,
                    vram: app.extensionManager.setting.get(this.settingsShowVRAM.id) ?? true,
                    vramSpeed: app.extensionManager.setting.get(this.settingsShowVRAMSpeed.id) ?? true,
                    sharedGpuSpeed: app.extensionManager.setting.get(this.settingsShowSharedGPUSpeed.id) ?? true,
                    sharedGpuMem: app.extensionManager.setting.get(this.settingsShowSharedGPUMem.id) ?? true,
                };
            }
        });
        Object.defineProperty(this, "createSettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                app.ui.settings.addSetting(this.settingsHardwareCharts);
                app.ui.settings.addSetting(this.settingsRate);
                app.ui.settings.addSetting(this.settingsTransferSpeed);
                app.ui.settings.addSetting(this.settingsShowCPU);
                app.ui.settings.addSetting(this.settingsShowRAM);
                app.ui.settings.addSetting(this.settingsShowGPUUsage);
                app.ui.settings.addSetting(this.settingsShowGPUTemp);
                app.ui.settings.addSetting(this.settingsShowVRAM);
                app.ui.settings.addSetting(this.settingsShowVRAMSpeed);
                app.ui.settings.addSetting(this.settingsShowSharedGPUSpeed);
                app.ui.settings.addSetting(this.settingsShowSharedGPUMem);
                void this.getGPUsFromServer().then((gpus) => {
                    this.initializeHardwareCharts(gpus.length);
                });
            }
        });
        Object.defineProperty(this, "initializeHardwareCharts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (gpuCount) => {
                try {
                    console.log('[HardwareMonitor] Initializing charts with GPU count:', gpuCount);
                    const visibilitySettings = this.getChartVisibilitySettings();
                    await this.hardwareChartsUI.initializeCharts(gpuCount, visibilitySettings);
                    const chartsEnabled = app.extensionManager.setting.get(this.settingsHardwareCharts.id);
                    console.log('[HardwareMonitor] Charts enabled setting:', chartsEnabled, 'ID:', this.settingsHardwareCharts.id);
                    this.hardwareChartsUI.setEnabled(chartsEnabled === true || chartsEnabled === undefined);
                }
                catch (error) {
                    console.error('[HardwareMonitor] Failed to initialize hardware charts:', error);
                }
            }
        });
        Object.defineProperty(this, "moveMonitor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (menuPosition) => {
                let parentElement;
                switch (menuPosition) {
                    case MenuDisplayOptions.Disabled:
                        parentElement = document.getElementById('queue-button');
                        if (parentElement && this.monitorUI.rootElement) {
                            parentElement.insertAdjacentElement('afterend', this.crystoolsButtonGroup.element);
                        }
                        break;
                    case MenuDisplayOptions.Top:
                    case MenuDisplayOptions.Bottom:
                        app.menu?.settingsGroup.element.before(this.crystoolsButtonGroup.element);
                }
            }
        });
        Object.defineProperty(this, "updateServer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (data) => {
                const resp = await api.fetchApi('/crystools/monitor', {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                    cache: 'no-store',
                });
                if (resp.status === 200) {
                    return await resp.text();
                }
                throw new Error(resp.statusText);
            }
        });
        Object.defineProperty(this, "getGPUsFromServer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async () => {
                return this.getDataFromServer('GPU');
            }
        });
        Object.defineProperty(this, "getDataFromServer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (what) => {
                const resp = await api.fetchApi(`/crystools/monitor/${what}`, {
                    method: 'GET',
                    cache: 'no-store',
                });
                if (resp.status === 200) {
                    return await resp.json();
                }
                throw new Error(resp.statusText);
            }
        });
        Object.defineProperty(this, "setup", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                console.log('[HardwareMonitor] Setup called');
                if (this.monitorUI) {
                    console.log('[HardwareMonitor] Already initialized, skipping');
                    return;
                }
                this.hardwareChartsUI = new HardwareChartsUI();
                this.hardwareChartsUI.createDOM();
                this.createSettingsRate();
                this.createSettingsHardwareCharts();
                this.createSettingsTransferSpeed();
                this.createChartVisibilitySettings();
                this.createSettings();
                console.log('[HardwareMonitor] Settings created');
                const currentRate = parseFloat(app.extensionManager.setting.get(this.settingsRate.id));
                this.menuDisplayOption = app.extensionManager.setting.get(ComfyKeyMenuDisplayOption);
                this.crystoolsButtonGroup = new ComfyButtonGroup();
                app.menu?.settingsGroup.element.before(this.crystoolsButtonGroup.element);
                const emptySettings = {
                    id: '',
                    name: '',
                    category: [],
                    type: 'boolean',
                    label: '',
                    symbol: '',
                    defaultValue: false,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: '',
                    onChange: async () => { },
                };
                this.monitorUI = new MonitorUI(this.crystoolsButtonGroup.element, emptySettings, emptySettings, emptySettings, [], [], [], currentRate);
                this.monitorUI.hideAllMonitors();
                this.moveMonitor(this.menuDisplayOption);
                this.registerListeners();
            }
        });
        Object.defineProperty(this, "registerListeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                console.log('[HardwareMonitor] Registering event listeners');
                api.addEventListener('crystools.monitor', (event) => {
                    if (event?.detail === undefined) {
                        return;
                    }
                    if (this.hardwareChartsUI?.isEnabled()) {
                        this.hardwareChartsUI.updateAllCharts(event.detail);
                    }
                }, false);
            }
        });
    }
}
const hardwareMonitor = new HardwareMonitor();
app.registerExtension({
    name: hardwareMonitor.idExtensionName,
    setup: hardwareMonitor.setup,
});
