# ComfyUI Hardware Monitor

Real-time hardware monitoring panel for ComfyUI with live time-series charts.

## Features

- **Floating Charts Panel**: Draggable panel with real-time line charts
- **CPU Monitoring**: CPU usage percentage
- **RAM Monitoring**: RAM usage in GB
- **GPU Monitoring**: GPU usage percentage and temperature
- **VRAM Monitoring**: VRAM usage (percentage and GB)
- **Transfer Speed**: VRAM and Shared GPU memory transfer speeds (GB/s)
- **Shared GPU Memory**: Usage monitoring for Windows systems

## Screenshot

The floating panel displays 10 charts in a 5x2 grid layout:
- CPU Usage
- RAM Usage
- GPU Usage
- GPU Temp
- VRAM Usage
- VRAM Used
- VRAM Speed
- Shared GPU Speed
- Shared GPU Usage
- Shared GPU Used

## Installation

### Manual Installation

1. Navigate to your ComfyUI custom nodes directory:
   ```bash
   cd ComfyUI/custom_nodes
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/KANAsho116/ComfyUI_HardwareMonitor.git
   ```

3. Install dependencies:
   ```bash
   cd ComfyUI-HardwareMonitor
   pip install -r requirements.txt
   ```

4. Restart ComfyUI

## Configuration

Access settings via **Settings > Hardware Monitor**:

| Setting | Description |
|---------|-------------|
| Show Charts Panel | Enable/disable the floating charts panel |
| Refresh Rate | Update interval (0.25s - 2s, 0 to disable) |
| Transfer Speed Monitoring | Enable VRAM/Shared GPU transfer speed monitoring |
| Shared GPU Memory Monitoring | Enable Shared GPU memory monitoring (Windows only) |

## Requirements

- ComfyUI
- NVIDIA GPU with CUDA support (for GPU monitoring)
- Python packages: `torch`, `numpy`, `pynvml`, `py-cpuinfo`

### Platform Support

| Feature | Windows | Linux | macOS |
|---------|---------|-------|-------|
| CPU Monitoring | Yes | Yes | Yes |
| RAM Monitoring | Yes | Yes | Yes |
| GPU Usage | Yes | Yes | No |
| GPU Temperature | Yes | Yes | No |
| VRAM Monitoring | Yes | Yes | No |
| Transfer Speed | Yes | Yes | No |
| Shared GPU Memory | Yes | No | No |

## Usage

1. Enable the charts panel in Settings > Hardware Monitor > Show Charts Panel
2. The floating panel appears in the bottom-right corner
3. Drag the panel header to reposition
4. Click the X button to close (or disable in settings)

## Technical Details

- Uses Canvas 2D API for chart rendering
- 60-second data retention per chart
- Automatic HiDPI/Retina display support
- Responsive resize handling
- WebSocket-based real-time updates

## Credits

Based on the hardware monitoring code from [ComfyUI-Crystools](https://github.com/crystian/comfyui-crystools) by Crystian.

## License

MIT License
