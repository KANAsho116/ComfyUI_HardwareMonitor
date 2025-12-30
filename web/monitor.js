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
        Object.defineProperty(this, "settingsSharedGPUMemory", {
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
                    name: 'Refresh Rate (seconds)',
                    category: ['Hardware Monitor', 'Settings'],
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
                    name: 'Show Charts Panel',
                    category: ['Hardware Monitor', 'Settings'],
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
                    name: 'Transfer Speed Monitoring',
                    category: ['Hardware Monitor', 'Settings'],
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
        Object.defineProperty(this, "createSettingsSharedGPUMemory", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                this.settingsSharedGPUMemory = {
                    id: 'HardwareMonitor.SharedGPUMemory',
                    name: 'Shared GPU Memory Monitoring',
                    category: ['Hardware Monitor', 'Settings'],
                    type: 'boolean',
                    label: 'Shared',
                    symbol: '%',
                    tooltip: 'Monitor Shared GPU Memory usage (Windows only)',
                    defaultValue: true,
                    htmlMonitorRef: undefined,
                    htmlMonitorSliderRef: undefined,
                    htmlMonitorLabelRef: undefined,
                    cssColor: Colors.SHARED_GPU_MEM,
                    onChange: async (value) => {
                        await this.updateServer({ switchSharedGPUMemory: value });
                    },
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
                app.ui.settings.addSetting(this.settingsSharedGPUMemory);
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
                    await this.hardwareChartsUI.initializeCharts(gpuCount);
                    const chartsEnabled = app.extensionManager.setting.get(this.settingsHardwareCharts.id);
                    this.hardwareChartsUI.setEnabled(chartsEnabled);
                }
                catch (error) {
                    console.error('Failed to initialize hardware charts:', error);
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
                if (this.monitorUI) {
                    return;
                }
                this.createSettingsRate();
                this.createSettingsHardwareCharts();
                this.createSettingsTransferSpeed();
                this.createSettingsSharedGPUMemory();
                this.createSettings();
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
                this.hardwareChartsUI = new HardwareChartsUI();
                this.hardwareChartsUI.createDOM();
                this.moveMonitor(this.menuDisplayOption);
                this.registerListeners();
            }
        });
        Object.defineProperty(this, "registerListeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
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
