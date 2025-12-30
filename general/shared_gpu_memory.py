"""
Shared GPU Memory Usage Module

Retrieves shared GPU memory usage on Windows.
Uses Windows Performance Counters for accurate measurement.
"""
import platform
import threading
import subprocess
from ..core import logger

IS_WINDOWS = platform.system() == 'Windows'


class CSharedGPUMemoryInfo:
    """
    Shared GPU Memory Information Class

    Shared GPU Memory is system RAM that Windows allocates for GPU use
    when dedicated VRAM is insufficient.
    """

    def __init__(self):
        self.switchSharedGPUMemory = False
        self._lock = threading.Lock()

        # Cached values
        self._shared_gpu_memory_used = -1
        self._shared_gpu_memory_total = -1
        self._shared_gpu_memory_percent = -1.0

        # Cache timing
        self._last_update_time = 0
        self._update_interval = 2.0  # Update every 2 seconds

        if IS_WINDOWS:
            logger.info("Shared GPU Memory monitoring initialized (Windows)")
        else:
            logger.info("Shared GPU Memory monitoring is only available on Windows")

    def _get_shared_memory_via_perfcounter(self) -> int:
        """
        Get shared GPU memory usage using Windows Performance Counters.
        Returns total shared memory usage across all GPU adapters in bytes.
        """
        try:
            # Use PowerShell to query GPU Adapter Memory performance counter
            # Using a loop-based approach to avoid $_ escaping issues
            ps_script = (
                '$samples = (Get-Counter "\\GPU Adapter Memory(*)\\Shared Usage" '
                '-ErrorAction SilentlyContinue).CounterSamples; '
                '$sum = 0; foreach($s in $samples) { $sum += $s.CookedValue }; $sum'
            )
            cmd = ['powershell.exe', '-NoProfile', '-Command', ps_script]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW if IS_WINDOWS else 0
            )

            if result.returncode == 0 and result.stdout.strip():
                try:
                    # Parse the sum of shared memory usage
                    total_shared = float(result.stdout.strip())
                    return int(total_shared)
                except ValueError:
                    pass

        except subprocess.TimeoutExpired:
            logger.debug("Performance Counter query timed out")
        except Exception as e:
            logger.debug(f"Failed to get shared memory via Performance Counter: {e}")

        return -1

    def _get_total_shared_memory(self) -> int:
        """
        Get total available shared GPU memory.
        This is typically half of system RAM on Windows.
        """
        try:
            import psutil
            mem = psutil.virtual_memory()
            # Windows typically allows up to 50% of RAM for shared GPU memory
            return mem.total // 2
        except Exception as e:
            logger.debug(f"Failed to get total shared memory: {e}")
            return -1

    def get_shared_gpu_memory_info(self) -> dict:
        """
        Get shared GPU memory usage information.

        Returns:
            Dictionary with:
            - shared_gpu_memory_used: Bytes of shared GPU memory in use
            - shared_gpu_memory_total: Total available shared GPU memory
            - shared_gpu_memory_percent: Usage percentage
        """
        if not self.switchSharedGPUMemory:
            return {
                'shared_gpu_memory_used': -1,
                'shared_gpu_memory_total': -1,
                'shared_gpu_memory_percent': -1.0
            }

        if not IS_WINDOWS:
            return {
                'shared_gpu_memory_used': -1,
                'shared_gpu_memory_total': -1,
                'shared_gpu_memory_percent': -1.0
            }

        import time
        current_time = time.time()

        with self._lock:
            # Check if we need to update
            if current_time - self._last_update_time < self._update_interval:
                return {
                    'shared_gpu_memory_used': self._shared_gpu_memory_used,
                    'shared_gpu_memory_total': self._shared_gpu_memory_total,
                    'shared_gpu_memory_percent': self._shared_gpu_memory_percent
                }

            # Get shared memory via Performance Counter
            shared_used = self._get_shared_memory_via_perfcounter()
            shared_total = self._get_total_shared_memory()

            if shared_used >= 0:
                self._shared_gpu_memory_used = shared_used
            else:
                self._shared_gpu_memory_used = 0

            if shared_total > 0:
                self._shared_gpu_memory_total = shared_total
            else:
                self._shared_gpu_memory_total = 0

            # Calculate percentage
            if self._shared_gpu_memory_total > 0 and self._shared_gpu_memory_used >= 0:
                self._shared_gpu_memory_percent = (
                    self._shared_gpu_memory_used / self._shared_gpu_memory_total * 100
                )
            else:
                self._shared_gpu_memory_percent = 0.0

            self._last_update_time = current_time

            return {
                'shared_gpu_memory_used': self._shared_gpu_memory_used,
                'shared_gpu_memory_total': self._shared_gpu_memory_total,
                'shared_gpu_memory_percent': self._shared_gpu_memory_percent
            }

    def close(self):
        """Clean up resources."""
        pass
