"""
Pytest configuration and fixtures for ComfyUI-HardwareMonitor tests.

This module sets up the test environment to work with ComfyUI's custom node structure.
"""
import pytest
import sys
import os
from unittest.mock import MagicMock, patch

# Add parent directory to path for imports
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
PACKAGE_DIR = os.path.dirname(TEST_DIR)


# Tell pytest to ignore the parent __init__.py
collect_ignore = ["../__init__.py"]


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment with mocked ComfyUI dependencies."""
    # Mock ComfyUI modules
    mock_server = MagicMock()
    mock_server.PromptServer = MagicMock()
    mock_server.PromptServer.instance = MagicMock()

    mock_model_management = MagicMock()
    mock_model_management.get_torch_device.return_value = 'cuda:0'
    mock_model_management.get_torch_device_name.return_value = 'NVIDIA GeForce RTX 3080'

    mock_comfy = MagicMock()
    mock_comfy.model_management = mock_model_management

    # Mock core module
    mock_logger = MagicMock()
    mock_logger.info = MagicMock()
    mock_logger.debug = MagicMock()
    mock_logger.warning = MagicMock()
    mock_logger.error = MagicMock()

    # Patch sys.modules before any imports
    sys.modules['server'] = mock_server
    sys.modules['comfy'] = mock_comfy
    sys.modules['comfy.model_management'] = mock_model_management

    yield

    # Cleanup
    for mod in ['server', 'comfy', 'comfy.model_management']:
        if mod in sys.modules:
            del sys.modules[mod]


@pytest.fixture
def mock_pynvml():
    """Mock pynvml for GPU tests."""
    mock = MagicMock()
    mock.nvmlInit.return_value = None
    mock.nvmlShutdown.return_value = None
    mock.nvmlDeviceGetCount.return_value = 1
    mock.nvmlDeviceGetHandleByIndex.return_value = MagicMock()
    mock.nvmlDeviceGetName.return_value = b'NVIDIA GeForce RTX 3080'
    mock.nvmlDeviceGetUtilizationRates.return_value = MagicMock(gpu=45)
    mock.nvmlDeviceGetMemoryInfo.return_value = MagicMock(
        total=10737418240,  # 10GB
        used=4294967296     # 4GB
    )
    mock.nvmlDeviceGetTemperature.return_value = 65
    mock.NVML_TEMPERATURE_GPU = 0
    return mock


@pytest.fixture
def mock_jtop():
    """Mock jtop for Jetson tests."""
    mock_instance = MagicMock()
    mock_instance.gpu = {'GPU': {'util': 50}}
    mock_instance.stats = {'GPU': 50, 'Temp gpu': 55}
    mock_instance.memory = {'RAM': {'tot': 8589934592, 'used': 4294967296}}

    mock_class = MagicMock(return_value=mock_instance)
    return mock_class, mock_instance


@pytest.fixture
def mock_torch():
    """Mock torch for transfer speed tests."""
    mock = MagicMock()
    mock.cuda.is_available.return_value = True
    mock.cuda.get_device_name.return_value = 'NVIDIA GeForce RTX 3080'
    mock.cuda.synchronize.return_value = None
    mock.cuda.empty_cache.return_value = None

    # Mock tensor creation and transfer
    mock_tensor = MagicMock()
    mock_tensor.to.return_value = MagicMock()
    mock_tensor.pin_memory.return_value = mock_tensor
    mock.randn.return_value = mock_tensor
    mock.float32 = 'float32'

    return mock


@pytest.fixture
def mock_psutil():
    """Mock psutil for system monitoring tests."""
    mock = MagicMock()
    mock.cpu_percent.return_value = 25.5
    mock.virtual_memory.return_value = MagicMock(
        total=34359738368,  # 32GB
        used=17179869184,   # 16GB
        percent=50.0
    )
    return mock


@pytest.fixture
def mock_subprocess_success():
    """Mock subprocess for successful PowerShell queries."""
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = '1073741824'  # 1GB in bytes
    return mock_result


@pytest.fixture
def mock_subprocess_timeout():
    """Mock subprocess for timeout scenarios."""
    import subprocess
    return subprocess.TimeoutExpired(cmd='powershell', timeout=2)
