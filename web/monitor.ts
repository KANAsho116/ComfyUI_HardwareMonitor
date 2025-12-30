import { app, api, ComfyButtonGroup } from './comfy/index.js';
import { MonitorUI } from './monitorUI.js';
import { HardwareChartsUI } from './hardwareChartsUI.js';
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
      defaultValue: false,
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
      defaultValue: false,
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
      defaultValue: false,
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

  createSettings = (): void => {
    app.ui.settings.addSetting(this.settingsHardwareCharts);
    app.ui.settings.addSetting(this.settingsRate);
    app.ui.settings.addSetting(this.settingsTransferSpeed);
    app.ui.settings.addSetting(this.settingsSharedGPUMemory);

    void this.getGPUsFromServer().then((gpus: TGpuName[]): void => {
      this.initializeHardwareCharts(gpus.length);
    });
  };

  initializeHardwareCharts = async(gpuCount: number): Promise<void> => {
    try {
      await this.hardwareChartsUI.initializeCharts(gpuCount);
      const chartsEnabled = app.extensionManager.setting.get(this.settingsHardwareCharts.id);
      this.hardwareChartsUI.setEnabled(chartsEnabled);
    } catch (error) {
      console.error('Failed to initialize hardware charts:', error);
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

    this.hardwareChartsUI = new HardwareChartsUI();
    this.hardwareChartsUI.createDOM();

    this.moveMonitor(this.menuDisplayOption);
    this.registerListeners();
  };

  registerListeners = (): void => {
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
