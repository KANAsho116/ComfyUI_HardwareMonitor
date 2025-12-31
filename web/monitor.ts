import { app, api, ComfyButtonGroup } from './comfy/index.js';
import { MonitorUI } from './monitorUI.js';
import { HardwareChartsUI, ChartVisibilitySettings } from './hardwareChartsUI.js';
import { Colors } from './styles.js';
import { ComfyKeyMenuDisplayOption, MenuDisplayOptions } from './progressBarUIBase.js';

class HardwareMonitor {
  readonly idExtensionName = 'HardwareMonitor';
  private menuDisplayOption: MenuDisplayOptions = MenuDisplayOptions.Disabled;
  private crystoolsButtonGroup: ComfyButtonGroup = null;

  private settingsRate: TMonitorSettings;
  private monitorUI: MonitorUI;
  private hardwareChartsUI: HardwareChartsUI;
  private settingsHardwareCharts: TMonitorSettings;
  private settingsTransferSpeed: TMonitorSettings;
  private settingsSharedGPUMemory: TMonitorSettings;

  // Chart visibility settings
  private settingsShowCPU: TMonitorSettings;
  private settingsShowRAM: TMonitorSettings;
  private settingsShowGPUUsage: TMonitorSettings;
  private settingsShowGPUTemp: TMonitorSettings;
  private settingsShowVRAM: TMonitorSettings;
  private settingsShowVRAMSpeed: TMonitorSettings;
  private settingsShowSharedGPUSpeed: TMonitorSettings;
  private settingsShowSharedGPUMem: TMonitorSettings;

  createSettingsRate = (): void => {
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
      // @ts-ignore
      onChange: async(value: string): Promise<void> => {
        let valueNumber: number;
        try {
          valueNumber = parseFloat(value);
          if (isNaN(valueNumber)) {
            throw new Error('invalid value');
          }
        } catch (error) {
          console.error(error);
          return;
        }
        try {
          await this.updateServer({rate: valueNumber});
        } catch (error) {
          console.error(error);
          return;
        }
      },
    };
  };

  createSettingsHardwareCharts = (): void => {
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
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setEnabled(value);
      },
    };
  };

  createSettingsTransferSpeed = (): void => {
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
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        await this.updateServer({switchTransferSpeed: value});
      },
    };
  };

  createSettingsSharedGPUMemory = (): void => {
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
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        await this.updateServer({switchSharedGPUMemory: value});
      },
    };
  };

  createChartVisibilitySettings = (): void => {
    // CPU Chart visibility
    this.settingsShowCPU = {
      id: 'HardwareMonitor.ShowCPU',
      name: 'Show CPU Chart',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'CPU',
      symbol: '',
      tooltip: 'Show/hide CPU usage chart',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.CPU,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('cpu', value);
      },
    };

    // RAM Chart visibility
    this.settingsShowRAM = {
      id: 'HardwareMonitor.ShowRAM',
      name: 'Show RAM Chart',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'RAM',
      symbol: '',
      tooltip: 'Show/hide RAM usage chart',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.RAM,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('ram', value);
      },
    };

    // GPU Usage Chart visibility
    this.settingsShowGPUUsage = {
      id: 'HardwareMonitor.ShowGPUUsage',
      name: 'Show GPU Usage Chart',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'GPU Usage',
      symbol: '',
      tooltip: 'Show/hide GPU usage chart',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.GPU,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('gpuUsage', value);
      },
    };

    // GPU Temperature Chart visibility
    this.settingsShowGPUTemp = {
      id: 'HardwareMonitor.ShowGPUTemp',
      name: 'Show GPU Temperature Chart',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'GPU Temp',
      symbol: '',
      tooltip: 'Show/hide GPU temperature chart',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.TEMP_END,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('gpuTemp', value);
      },
    };

    // VRAM Chart visibility (includes both usage % and used GB)
    this.settingsShowVRAM = {
      id: 'HardwareMonitor.ShowVRAM',
      name: 'Show VRAM Charts',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'VRAM',
      symbol: '',
      tooltip: 'Show/hide VRAM usage and used charts',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.VRAM,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('vram', value);
      },
    };

    // VRAM Speed Chart visibility
    this.settingsShowVRAMSpeed = {
      id: 'HardwareMonitor.ShowVRAMSpeed',
      name: 'Show VRAM Speed Chart',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'VRAM Speed',
      symbol: '',
      tooltip: 'Show/hide VRAM transfer speed chart',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.VRAM_SPEED,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('vramSpeed', value);
      },
    };

    // Shared GPU Speed Chart visibility
    this.settingsShowSharedGPUSpeed = {
      id: 'HardwareMonitor.ShowSharedGPUSpeed',
      name: 'Show Shared GPU Speed Chart',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'Shared GPU Speed',
      symbol: '',
      tooltip: 'Show/hide shared GPU memory transfer speed chart',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.SHARED_GPU_SPEED,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('sharedGpuSpeed', value);
      },
    };

    // Shared GPU Memory Chart visibility
    this.settingsShowSharedGPUMem = {
      id: 'HardwareMonitor.ShowSharedGPUMem',
      name: 'Show Shared GPU Memory Charts',
      category: ['Hardware Monitor', 'Chart Visibility'],
      type: 'boolean',
      label: 'Shared GPU Mem',
      symbol: '',
      tooltip: 'Show/hide shared GPU memory usage charts',
      defaultValue: true,
      htmlMonitorRef: undefined,
      htmlMonitorSliderRef: undefined,
      htmlMonitorLabelRef: undefined,
      cssColor: Colors.SHARED_GPU_MEM,
      // @ts-ignore
      onChange: async(value: boolean): Promise<void> => {
        this.hardwareChartsUI?.setChartVisibility('sharedGpuMem', value);
      },
    };
  };

  getChartVisibilitySettings = (): ChartVisibilitySettings => {
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
  };

  createSettings = (): void => {
    app.ui.settings.addSetting(this.settingsHardwareCharts);
    app.ui.settings.addSetting(this.settingsRate);
    app.ui.settings.addSetting(this.settingsTransferSpeed);
    app.ui.settings.addSetting(this.settingsSharedGPUMemory);

    // Chart visibility settings
    app.ui.settings.addSetting(this.settingsShowCPU);
    app.ui.settings.addSetting(this.settingsShowRAM);
    app.ui.settings.addSetting(this.settingsShowGPUUsage);
    app.ui.settings.addSetting(this.settingsShowGPUTemp);
    app.ui.settings.addSetting(this.settingsShowVRAM);
    app.ui.settings.addSetting(this.settingsShowVRAMSpeed);
    app.ui.settings.addSetting(this.settingsShowSharedGPUSpeed);
    app.ui.settings.addSetting(this.settingsShowSharedGPUMem);

    void this.getGPUsFromServer().then((gpus: TGpuName[]): void => {
      this.initializeHardwareCharts(gpus.length);
    });
  };

  initializeHardwareCharts = async(gpuCount: number): Promise<void> => {
    try {
      console.log('[HardwareMonitor] Initializing charts with GPU count:', gpuCount);
      const visibilitySettings = this.getChartVisibilitySettings();
      await this.hardwareChartsUI.initializeCharts(gpuCount, visibilitySettings);
      const chartsEnabled = app.extensionManager.setting.get(this.settingsHardwareCharts.id);
      console.log('[HardwareMonitor] Charts enabled setting:', chartsEnabled, 'ID:', this.settingsHardwareCharts.id);
      this.hardwareChartsUI.setEnabled(chartsEnabled === true || chartsEnabled === undefined);
    } catch (error) {
      console.error('[HardwareMonitor] Failed to initialize hardware charts:', error);
    }
  };

  moveMonitor = (menuPosition: MenuDisplayOptions): void => {
    let parentElement: Element | null | undefined;

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
  };

  updateServer = async(data: TStatsSettings): Promise<string> => {
    const resp = await api.fetchApi('/crystools/monitor', {
      method: 'PATCH',
      body: JSON.stringify(data),
      cache: 'no-store',
    });
    if (resp.status === 200) {
      return await resp.text();
    }
    throw new Error(resp.statusText);
  };

  getGPUsFromServer = async(): Promise<TGpuName[]> => {
    return this.getDataFromServer<TGpuName>('GPU');
  };

  getDataFromServer = async <T>(what: string): Promise<T[]> => {
    const resp = await api.fetchApi(`/crystools/monitor/${what}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (resp.status === 200) {
      return await resp.json();
    }
    throw new Error(resp.statusText);
  };

  setup = (): void => {
    console.log('[HardwareMonitor] Setup called');
    if (this.monitorUI) {
      console.log('[HardwareMonitor] Already initialized, skipping');
      return;
    }

    // Initialize HardwareChartsUI FIRST before createSettings
    // because createSettings triggers async GPU fetch that calls initializeHardwareCharts
    this.hardwareChartsUI = new HardwareChartsUI();
    this.hardwareChartsUI.createDOM();

    this.createSettingsRate();
    this.createSettingsHardwareCharts();
    this.createSettingsTransferSpeed();
    this.createSettingsSharedGPUMemory();
    this.createChartVisibilitySettings();
    this.createSettings();
    console.log('[HardwareMonitor] Settings created');

    const currentRate = parseFloat(app.extensionManager.setting.get(this.settingsRate.id));

    this.menuDisplayOption = app.extensionManager.setting.get(ComfyKeyMenuDisplayOption);

    this.crystoolsButtonGroup = new ComfyButtonGroup();
    app.menu?.settingsGroup.element.before(this.crystoolsButtonGroup.element);

    const emptySettings: TMonitorSettings = {
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
      // @ts-ignore
      onChange: async(): Promise<void> => {},
    };

    this.monitorUI = new MonitorUI(
      this.crystoolsButtonGroup.element,
      emptySettings,
      emptySettings,
      emptySettings,
      [],
      [],
      [],
      currentRate,
    );

    this.monitorUI.hideAllMonitors();

    this.moveMonitor(this.menuDisplayOption);
    this.registerListeners();
  };

  registerListeners = (): void => {
    console.log('[HardwareMonitor] Registering event listeners');
    api.addEventListener('crystools.monitor', (event: CustomEvent) => {
      if (event?.detail === undefined) {
        return;
      }

      if (this.hardwareChartsUI?.isEnabled()) {
        this.hardwareChartsUI.updateAllCharts(event.detail);
      }
    }, false);
  };
}

const hardwareMonitor = new HardwareMonitor();
app.registerExtension({
  name: hardwareMonitor.idExtensionName,
  setup: hardwareMonitor.setup,
});
