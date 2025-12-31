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

# Retry configuration
MAX_MEASUREMENT_RETRIES = 2
FAILURE_COOLDOWN = 30.0  # seconds to wait after repeated failures


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

        # Cached results (last successful measurements)
        self._last_vram_speed = -1.0
        self._last_shared_speed = -1.0
        self._last_measurement_time = 0.0

        # Error tracking
        self._consecutive_failures = 0
        self._last_failure_time = 0.0
        self._in_cooldown = False

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

        # Check if in cooldown after repeated failures
        if self._in_cooldown:
            if (current_time - self._last_failure_time) >= FAILURE_COOLDOWN:
                self._in_cooldown = False
                self._consecutive_failures = 0
                logger.debug('Transfer speed measurement cooldown ended.')
            else:
                return False

        return (current_time - self._last_measurement_time) >= self.measurement_interval

    def _record_failure(self):
        """Record a measurement failure and enter cooldown if necessary."""
        self._consecutive_failures += 1
        self._last_failure_time = time.time()

        if self._consecutive_failures >= MAX_MEASUREMENT_RETRIES:
            self._in_cooldown = True
            logger.warning(f'Transfer speed measurement entering cooldown for {FAILURE_COOLDOWN}s after {self._consecutive_failures} failures.')

    def _record_success(self):
        """Record a successful measurement."""
        self._consecutive_failures = 0
        self._in_cooldown = False

    def measure_vram_speed(self) -> float:
        """
        Measure VRAM (dedicated GPU memory) transfer speed with retry logic.

        Returns:
            Transfer speed in MB/s, or -1 if measurement fails or CUDA is unavailable.
        """
        if not self.cuda_available or not self.switchTransferSpeed:
            return -1.0

        for attempt in range(MAX_MEASUREMENT_RETRIES):
            try:
                speed = self._measure_vram_speed_internal()
                if speed > 0:
                    return speed
            except Exception as e:
                if attempt < MAX_MEASUREMENT_RETRIES - 1:
                    logger.debug(f"VRAM speed measurement failed (attempt {attempt + 1}), retrying: {e}")
                    time.sleep(0.1)  # Brief pause before retry
                else:
                    logger.error(f"Error measuring VRAM transfer speed: {e}")

        return -1.0

    def _measure_vram_speed_internal(self) -> float:
        """Internal VRAM speed measurement without retry logic."""
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

    def measure_shared_gpu_memory_speed(self) -> float:
        """
        Measure Shared GPU Memory (pinned memory) transfer speed with retry logic.

        Pinned memory provides faster CPU-GPU transfers by using page-locked memory,
        which is similar to how Windows Shared GPU Memory operates.

        Returns:
            Transfer speed in MB/s, or -1 if measurement fails or CUDA is unavailable.
        """
        if not self.cuda_available or not self.switchTransferSpeed:
            return -1.0

        for attempt in range(MAX_MEASUREMENT_RETRIES):
            try:
                speed = self._measure_shared_gpu_memory_speed_internal()
                if speed > 0:
                    return speed
            except Exception as e:
                if attempt < MAX_MEASUREMENT_RETRIES - 1:
                    logger.debug(f"Shared GPU memory speed measurement failed (attempt {attempt + 1}), retrying: {e}")
                    time.sleep(0.1)  # Brief pause before retry
                else:
                    logger.error(f"Error measuring shared GPU memory transfer speed: {e}")

        return -1.0

    def _measure_shared_gpu_memory_speed_internal(self) -> float:
        """Internal shared GPU memory speed measurement without retry logic."""
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

    def get_speeds(self) -> dict:
        """
        Get both VRAM and Shared GPU Memory transfer speeds.

        Uses caching to avoid frequent measurements (respects measurement_interval).
        On failure, returns last successful cached values if available.

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
                # Return cached values if not enough time has passed or in cooldown
                return {
                    'vram_speed': self._last_vram_speed,
                    'shared_gpu_speed': self._last_shared_speed
                }

            self._measuring = True

        try:
            # Perform measurements
            vram_speed = self.measure_vram_speed()
            shared_speed = self.measure_shared_gpu_memory_speed()

            # Check if any measurement failed
            any_failed = (vram_speed < 0 or shared_speed < 0)

            with self._lock:
                # Only update cached values if measurement succeeded
                if vram_speed > 0:
                    self._last_vram_speed = vram_speed
                if shared_speed > 0:
                    self._last_shared_speed = shared_speed

                self._last_measurement_time = time.time()
                self._measuring = False

                if any_failed:
                    self._record_failure()
                else:
                    self._record_success()

                # Return cached values (which may include last successful values on partial failure)
                return {
                    'vram_speed': self._last_vram_speed,
                    'shared_gpu_speed': self._last_shared_speed
                }

        except Exception as e:
            logger.error(f"Error getting transfer speeds: {e}")
            with self._lock:
                self._measuring = False
                self._record_failure()
                # Return cached values on error
                return {
                    'vram_speed': self._last_vram_speed,
                    'shared_gpu_speed': self._last_shared_speed
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
