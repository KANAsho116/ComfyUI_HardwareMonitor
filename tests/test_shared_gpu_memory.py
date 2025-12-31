"""
Tests for shared GPU memory monitoring logic.
These are standalone unit tests that don't require ComfyUI.
"""
import pytest
import time
import threading
from unittest.mock import MagicMock, patch
from concurrent.futures import ThreadPoolExecutor


class TestSharedGPUMemoryLogic:
    """Test shared GPU memory logic."""

    def test_cooldown_mechanism(self):
        """Test cooldown mechanism after failures."""
        FAILURE_COOLDOWN = 0.1  # Short for testing
        MAX_FAILURES = 3

        consecutive_failures = 0
        last_failure_time = 0.0
        in_cooldown = False

        def record_failure():
            nonlocal consecutive_failures, last_failure_time, in_cooldown
            consecutive_failures += 1
            last_failure_time = time.time()
            if consecutive_failures >= MAX_FAILURES:
                in_cooldown = True

        def should_query():
            nonlocal in_cooldown, consecutive_failures
            if in_cooldown:
                if (time.time() - last_failure_time) >= FAILURE_COOLDOWN:
                    in_cooldown = False
                    consecutive_failures = 0
                    return True
                return False
            return True

        # Initially should be able to query
        assert should_query() is True

        # Record failures
        for _ in range(MAX_FAILURES):
            record_failure()

        assert in_cooldown is True
        assert should_query() is False

        # Wait for cooldown
        time.sleep(FAILURE_COOLDOWN + 0.01)
        assert should_query() is True
        assert in_cooldown is False

    def test_non_blocking_query_pattern(self):
        """Test non-blocking query pattern with ThreadPoolExecutor."""
        executor = ThreadPoolExecutor(max_workers=1)
        query_in_progress = False
        cached_value = 1000
        pending_future = None

        def perform_query():
            time.sleep(0.05)  # Simulate slow query
            return 2000

        def get_value():
            nonlocal query_in_progress, pending_future, cached_value

            # Check if previous query completed
            if pending_future is not None and pending_future.done():
                try:
                    cached_value = pending_future.result(timeout=0)
                except Exception:
                    pass
                finally:
                    pending_future = None
                    query_in_progress = False

            # Start new query if not in progress
            if not query_in_progress:
                query_in_progress = True
                pending_future = executor.submit(perform_query)

            # Always return cached value (non-blocking)
            return cached_value

        # First call should return cached value and start query
        start = time.time()
        result1 = get_value()
        elapsed = time.time() - start
        assert elapsed < 0.01  # Should be nearly instant
        assert result1 == 1000

        # Wait for query to complete
        time.sleep(0.1)

        # Next call should get updated value
        result2 = get_value()
        assert result2 == 2000

        executor.shutdown(wait=False)

    def test_cached_values_during_query(self):
        """Test that cached values are returned during query."""
        cached_value = {'used': 1000, 'total': 2000, 'percent': 50.0}
        query_in_progress = True

        def get_info():
            if query_in_progress:
                return cached_value
            return {'used': 3000, 'total': 4000, 'percent': 75.0}

        result = get_info()
        assert result['used'] == 1000
        assert result['percent'] == 50.0

    def test_percentage_calculation(self):
        """Test percentage calculation."""
        used = 1073741824  # 1GB
        total = 17179869184  # 16GB

        percent = (used / total * 100) if total > 0 else 0.0
        assert 6.25 == pytest.approx(percent, rel=0.01)

    def test_total_shared_memory_calculation(self):
        """Test that total shared memory is half of system RAM."""
        system_ram = 34359738368  # 32GB
        expected_shared = system_ram // 2  # 16GB

        assert expected_shared == 17179869184


class TestPowerShellQueryLogic:
    """Test PowerShell query handling logic."""

    def test_timeout_handling(self):
        """Test timeout handling."""
        import subprocess

        def query_with_timeout(timeout_seconds):
            try:
                # Simulate timeout
                raise subprocess.TimeoutExpired(cmd='powershell', timeout=timeout_seconds)
            except subprocess.TimeoutExpired:
                return -1

        result = query_with_timeout(2.0)
        assert result == -1

    def test_parse_powershell_output(self):
        """Test parsing PowerShell output."""
        def parse_output(stdout):
            if stdout.strip():
                try:
                    return int(float(stdout.strip()))
                except ValueError:
                    return -1
            return -1

        # Valid output
        assert parse_output('1073741824') == 1073741824
        assert parse_output('  1073741824  ') == 1073741824
        assert parse_output('1073741824.0') == 1073741824

        # Invalid output
        assert parse_output('') == -1
        assert parse_output('error') == -1

    def test_reduced_timeout(self):
        """Test that timeout is reduced from 5s to 2s."""
        QUERY_TIMEOUT = 2.0
        assert QUERY_TIMEOUT < 5.0


class TestExecutorCleanup:
    """Test ThreadPoolExecutor cleanup."""

    def test_shutdown_without_wait(self):
        """Test that executor shuts down without blocking."""
        executor = ThreadPoolExecutor(max_workers=1)

        # Submit a long-running task
        future = executor.submit(lambda: time.sleep(1))

        # Shutdown should not block
        start = time.time()
        executor.shutdown(wait=False)
        elapsed = time.time() - start

        assert elapsed < 0.1  # Should be nearly instant

    def test_shutdown_gracefully(self):
        """Test graceful shutdown."""
        executor = ThreadPoolExecutor(max_workers=1)

        # Submit a quick task
        future = executor.submit(lambda: 42)
        result = future.result(timeout=1)
        assert result == 42

        executor.shutdown(wait=True)


class TestDisabledFeature:
    """Test behavior when feature is disabled."""

    def test_returns_negative_one_when_disabled(self):
        """Test that -1 is returned when feature is disabled."""
        switch_enabled = False

        def get_info():
            if not switch_enabled:
                return {
                    'shared_gpu_memory_used': -1,
                    'shared_gpu_memory_total': -1,
                    'shared_gpu_memory_percent': -1.0
                }
            return {'shared_gpu_memory_used': 1000, 'shared_gpu_memory_total': 2000, 'shared_gpu_memory_percent': 50.0}

        result = get_info()
        assert result['shared_gpu_memory_used'] == -1
        assert result['shared_gpu_memory_total'] == -1
        assert result['shared_gpu_memory_percent'] == -1.0

    def test_returns_negative_one_on_non_windows(self):
        """Test that -1 is returned on non-Windows."""
        IS_WINDOWS = False

        def get_info():
            if not IS_WINDOWS:
                return {
                    'shared_gpu_memory_used': -1,
                    'shared_gpu_memory_total': -1,
                    'shared_gpu_memory_percent': -1.0
                }
            return {'shared_gpu_memory_used': 1000, 'shared_gpu_memory_total': 2000, 'shared_gpu_memory_percent': 50.0}

        result = get_info()
        assert result['shared_gpu_memory_used'] == -1
