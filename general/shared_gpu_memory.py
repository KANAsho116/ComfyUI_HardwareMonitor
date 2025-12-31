"""
Shared GPU Memory Usage Module

Retrieves shared GPU memory usage on Windows.
Uses Windows Performance Counters for accurate measurement.
"""
import platform
import threading
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from ..core import logger

IS_WINDOWS = platform.system() == 'Windows'

# Configuration
QUERY_TIMEOUT = 2.0  # seconds (reduced from 5)
MAX_CONSECUTIVE_FAILURES = 3
FAILURE_COOLDOWN = 60.0  # seconds


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

        # Background query management
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='SharedGPUMem')
        self._query_in_progress = False
        self._pending_future = None

        # Error tracking
        self._consecutive_failures = 0
        self._last_failure_time = 0.0
        self._in_cooldown = False

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
                timeout=QUERY_TIMEOUT,
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

    def _should_query(self) -> bool:
        """Check if we should perform a new query."""
        current_time = time.time()

        # Check if in cooldown after repeated failures
        if self._in_cooldown:
            if (current_time - self._last_failure_time) >= FAILURE_COOLDOWN:
                self._in_cooldown = False
                self._consecutive_failures = 0
                logger.debug('Shared GPU memory query cooldown ended.')
            else:
                return False

        return (current_time - self._last_update_time) >= self._update_interval

    def _record_failure(self):
        """Record a query failure and enter cooldown if necessary."""
        self._consecutive_failures += 1
        self._last_failure_time = time.time()

        if self._consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            self._in_cooldown = True
            logger.warning(f'Shared GPU memory query entering cooldown for {FAILURE_COOLDOWN}s after {self._consecutive_failures} failures.')

    def _record_success(self):
        """Record a successful query."""
        self._consecutive_failures = 0
        self._in_cooldown = False

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

    def _perform_query(self) -> tuple:
        """Perform the actual PowerShell query. Runs in background thread."""
        shared_used = self._get_shared_memory_via_perfcounter()
        shared_total = self._get_total_shared_memory()
        return (shared_used, shared_total)

    def get_shared_gpu_memory_info(self) -> dict:
        """
        Get shared GPU memory usage information (non-blocking).

        Uses background threads to avoid blocking the main monitoring loop.
        Returns cached values while queries are in progress.

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

        with self._lock:
            # Check if a previous query completed
            if self._pending_future is not None and self._pending_future.done():
                try:
                    shared_used, shared_total = self._pending_future.result(timeout=0)

                    if shared_used >= 0:
                        self._shared_gpu_memory_used = shared_used
                        self._record_success()
                    else:
                        self._record_failure()

                    if shared_total > 0:
                        self._shared_gpu_memory_total = shared_total

                    # Calculate percentage
                    if self._shared_gpu_memory_total > 0 and self._shared_gpu_memory_used >= 0:
                        self._shared_gpu_memory_percent = (
                            self._shared_gpu_memory_used / self._shared_gpu_memory_total * 100
                        )
                    else:
                        self._shared_gpu_memory_percent = 0.0

                    self._last_update_time = time.time()

                except Exception as e:
                    logger.debug(f"Error getting query result: {e}")
                    self._record_failure()
                finally:
                    self._pending_future = None
                    self._query_in_progress = False

            # Start a new query if needed and not already in progress
            if not self._query_in_progress and self._should_query():
                self._query_in_progress = True
                try:
                    self._pending_future = self._executor.submit(self._perform_query)
                except Exception as e:
                    logger.debug(f"Failed to submit query: {e}")
                    self._query_in_progress = False
                    self._record_failure()

            # Always return cached values (non-blocking)
            return {
                'shared_gpu_memory_used': self._shared_gpu_memory_used,
                'shared_gpu_memory_total': self._shared_gpu_memory_total,
                'shared_gpu_memory_percent': self._shared_gpu_memory_percent
            }

    def close(self):
        """Clean up resources."""
        try:
            self._executor.shutdown(wait=False)
            logger.debug('Shared GPU memory executor shutdown.')
        except Exception as e:
            logger.debug(f'Error shutting down executor: {e}')
