"""
@author: Original by Crystian, Modified for Hardware Monitor
@title: Hardware Monitor
@nickname: HardwareMonitor
@version: 1.0.0
@project: "https://github.com/KANAsho116/ComfyUI_HardwareMonitor"
@description: Real-time hardware monitoring panel for ComfyUI with CPU, RAM, GPU, VRAM, and transfer speed charts.
"""

from .core import version, logger
logger.info(f'Hardware Monitor version: {version}')

# Import server routes for hardware monitoring API
from .server import *
# Import general hardware monitoring utilities
from .general import *

# No custom nodes - this extension only provides hardware monitoring UI
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

WEB_DIRECTORY = "./web"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
