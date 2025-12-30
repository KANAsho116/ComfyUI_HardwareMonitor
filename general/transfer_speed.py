"""
GPU Transfer Speed Measurement Module

Measures VRAM and Shared GPU Memory transfer speeds using PyTorch CUDA.
"""
import time
import threading
from ..core import logger

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch is not available. Transfer speed measurement will be disabled.")


class CTransferSpeedInfo:
    """
    GPU Transfer Speed Measurement Class

    Measures data transfer speeds between CPU and GPU memory:
    - VRAM: Dedicated GPU memory transfer speed
    - Shared GPU Memory: Pinned/page-locked memory transfer speed
    """

    def __init__(self, test_size_mb: int = 32, measurement_interval: float = 5.0):
        """
        Initialize the transfer speed measurement class.

        Args:
            test_size_mb: Size of test data in MB (default: 32MB)
            measurement_interval: Minimum interval between measurements in seconds (default: 5.0)
        """
        self.test_size_mb = test_size_mb
        self.measurement_interval = measurement_interval

        self.cuda_available = TORCH_AVAILABLE and torch.cuda.is_available()
        self.switchTransferSpeed = False

        # Cached results
        self._last_vram_speed = -1.0
        self._last_shared_speed = -1.0
        self._last_measurement_time = 0.0

        # Thread safety
        self._lock = threading.Lock()
        self._measuring = False

        if self.cuda_available:
            logger.info(f"Transfer speed measurement initialized. CUDA device: {torch.cuda.get_device_name(0)}")
        else:
            logger.warning("CUDA is not available. Transfer speed measurement will return -1.")

    def _should_measure(self) -> bool:
        """Check if enough time has passed since last measurement."""
        current_time = time.time()
        return (current_time - self._last_measurement_time) >= self.measurement_interval

    def measure_vram_speed(self) -> float:
        """
        Measure VRAM (dedicated GPU memory) transfer speed.

        Returns:
            Transfer speed in MB/s, or -1 if measurement fails or CUDA is unavailable.
        """
        if not self.cuda_available or not self.switchTransferSpeed:
            return -1.0

        try:
            # Create test data on CPU (32MB = 32 * 1024 * 1024 / 4 bytes per float32)
            num_elements = self.test_size_mb * 1024 * 256  # MB to float32 elements
            data = torch.randn(num_elements, dtype=torch.float32, device='cpu')

            # Warm up
            torch.cuda.synchronize()

            # Measure transfer time
            start_time = time.perf_counter()
            gpu_data = data.to('cuda', non_blocking=False)
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - start_time

            # Calculate speed in MB/s
            speed = self.test_size_mb / elapsed if elapsed > 0 else 0

            # Cleanup
            del gpu_data
            del data
            torch.cuda.empty_cache()

            return speed

        except Exception as e:
            logger.error(f"Error measuring VRAM transfer speed: {e}")
            return -1.0

    def measure_shared_gpu_memory_speed(self) -> float:
        """
        Measure Shared GPU Memory (pinned memory) transfer speed.

        Pinned memory provides faster CPU-GPU transfers by using page-locked memory,
        which is similar to how Windows Shared GPU Memory operates.

        Returns:
            Transfer speed in MB/s, or -1 if measurement fails or CUDA is unavailable.
        """
        if not self.cuda_available or not self.switchTransferSpeed:
            return -1.0

        try:
            # Create test data with pinned memory
            num_elements = self.test_size_mb * 1024 * 256
            data = torch.randn(num_elements, dtype=torch.float32, device='cpu').pin_memory()

            # Warm up
            torch.cuda.synchronize()

            # Measure transfer time with pinned memory
            start_time = time.perf_counter()
            gpu_data = data.to('cuda', non_blocking=False)
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - start_time

            # Calculate speed in MB/s
            speed = self.test_size_mb / elapsed if elapsed > 0 else 0

            # Cleanup
            del gpu_data
            del data
            torch.cuda.empty_cache()

            return speed

        except Exception as e:
            logger.error(f"Error measuring shared GPU memory transfer speed: {e}")
            return -1.0

    def get_speeds(self) -> dict:
        """
        Get both VRAM and Shared GPU Memory transfer speeds.

        Uses caching to avoid frequent measurements (respects measurement_interval).

        Returns:
            Dictionary with 'vram_speed' and 'shared_gpu_speed' in MB/s.
        """
        if not self.switchTransferSpeed:
            return {
                'vram_speed': -1.0,
                'shared_gpu_speed': -1.0
            }

        with self._lock:
            if self._measuring:
                # Return cached values if measurement is in progress
                return {
                    'vram_speed': self._last_vram_speed,
                    'shared_gpu_speed': self._last_shared_speed
                }

            if not self._should_measure():
                # Return cached values if not enough time has passed
                return {
                    'vram_speed': self._last_vram_speed,
                    'shared_gpu_speed': self._last_shared_speed
                }

            self._measuring = True

        try:
            # Perform measurements
            vram_speed = self.measure_vram_speed()
            shared_speed = self.measure_shared_gpu_memory_speed()

            with self._lock:
                self._last_vram_speed = vram_speed
                self._last_shared_speed = shared_speed
                self._last_measurement_time = time.time()
                self._measuring = False

            return {
                'vram_speed': vram_speed,
                'shared_gpu_speed': shared_speed
            }

        except Exception as e:
            logger.error(f"Error getting transfer speeds: {e}")
            with self._lock:
                self._measuring = False
            return {
                'vram_speed': -1.0,
                'shared_gpu_speed': -1.0
            }

    def get_info(self) -> dict:
        """
        Get transfer speed measurement configuration info.

        Returns:
            Dictionary with measurement configuration.
        """
        return {
            'cuda_available': self.cuda_available,
            'test_size_mb': self.test_size_mb,
            'measurement_interval': self.measurement_interval,
            'switch_enabled': self.switchTransferSpeed
        }
