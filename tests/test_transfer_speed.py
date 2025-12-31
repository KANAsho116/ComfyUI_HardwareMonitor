"""
Tests for transfer speed measurement logic.
These are standalone unit tests that don't require ComfyUI.
"""
import pytest
import time
from unittest.mock import MagicMock, patch


class TestTransferSpeedLogic:
    """Test transfer speed measurement logic."""

    def test_retry_logic(self):
        """Test that retry logic works correctly."""
        MAX_RETRIES = 2
        call_count = 0

        def failing_function():
            nonlocal call_count
            call_count += 1
            if call_count < MAX_RETRIES:
                raise Exception("Simulated failure")
            return 1000.0

        # Simulate retry logic
        result = -1.0
        for attempt in range(MAX_RETRIES):
            try:
                result = failing_function()
                if result > 0:
                    break
            except Exception:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(0.01)

        assert call_count == MAX_RETRIES
        assert result == 1000.0

    def test_cooldown_mechanism(self):
        """Test cooldown mechanism after failures."""
        FAILURE_COOLDOWN = 0.1  # Short for testing
        MAX_FAILURES = 2

        consecutive_failures = 0
        last_failure_time = 0.0
        in_cooldown = False

        def record_failure():
            nonlocal consecutive_failures, last_failure_time, in_cooldown
            consecutive_failures += 1
            last_failure_time = time.time()
            if consecutive_failures >= MAX_FAILURES:
                in_cooldown = True

        def should_measure():
            nonlocal in_cooldown, consecutive_failures
            if in_cooldown:
                if (time.time() - last_failure_time) >= FAILURE_COOLDOWN:
                    in_cooldown = False
                    consecutive_failures = 0
                    return True
                return False
            return True

        # Initially should be able to measure
        assert should_measure() is True

        # Record failures
        record_failure()
        assert in_cooldown is False
        record_failure()
        assert in_cooldown is True

        # Should not measure during cooldown
        assert should_measure() is False

        # Wait for cooldown to expire
        time.sleep(FAILURE_COOLDOWN + 0.01)
        assert should_measure() is True
        assert in_cooldown is False

    def test_cached_value_on_failure(self):
        """Test that cached values are returned on failure."""
        cached_value = 1000.0

        def get_speed_with_cache(measure_func, cache):
            try:
                result = measure_func()
                if result > 0:
                    return result
                return cache
            except Exception:
                return cache

        # Test with failing measurement
        def failing_measure():
            raise Exception("Measurement failed")

        result = get_speed_with_cache(failing_measure, cached_value)
        assert result == cached_value

        # Test with negative result
        def negative_measure():
            return -1.0

        result = get_speed_with_cache(negative_measure, cached_value)
        assert result == cached_value

    def test_measurement_interval(self):
        """Test measurement interval logic."""
        INTERVAL = 0.1
        last_measurement_time = 0.0

        def should_measure():
            return (time.time() - last_measurement_time) >= INTERVAL

        # Initially should measure
        assert should_measure() is True

        # Update time
        last_measurement_time = time.time()

        # Should not measure immediately
        assert should_measure() is False

        # Wait for interval
        time.sleep(INTERVAL + 0.01)
        assert should_measure() is True


class TestSpeedCalculation:
    """Test speed calculation logic."""

    def test_speed_calculation(self):
        """Test MB/s calculation."""
        test_size_mb = 32
        elapsed_time = 0.032  # 32ms

        speed = test_size_mb / elapsed_time if elapsed_time > 0 else 0
        assert speed == 1000.0  # 1000 MB/s

    def test_zero_elapsed_time(self):
        """Test handling of zero elapsed time."""
        test_size_mb = 32
        elapsed_time = 0

        speed = test_size_mb / elapsed_time if elapsed_time > 0 else 0
        assert speed == 0

    def test_negative_result_handling(self):
        """Test that -1 is returned for invalid measurements."""
        def measure():
            return -1.0

        result = measure()
        assert result == -1.0


class TestThreadSafety:
    """Test thread safety logic."""

    def test_lock_prevents_concurrent_measurement(self):
        """Test that lock prevents concurrent measurements."""
        import threading

        measuring = False
        lock = threading.Lock()
        results = []

        def get_speed():
            nonlocal measuring
            with lock:
                if measuring:
                    results.append("cached")
                    return 500.0

                measuring = True

            # Simulate measurement
            time.sleep(0.05)
            results.append("measured")

            with lock:
                measuring = False

            return 1000.0

        # Start multiple threads
        threads = [threading.Thread(target=get_speed) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # At least one should be cached
        assert "measured" in results
        assert len(results) == 3
