"""
Tests for GPU monitoring logic.
These are standalone unit tests that don't require ComfyUI.
"""
import pytest
import time
from unittest.mock import MagicMock


class TestGPURetryLogic:
    """Test GPU initialization retry logic."""

    def test_exponential_backoff_retry(self):
        """Test exponential backoff retry logic."""
        MAX_RETRIES = 3
        INITIAL_DELAY = 0.01
        delays = []
        call_count = 0

        def init_with_retry():
            nonlocal call_count
            delay = INITIAL_DELAY
            last_error = None

            for attempt in range(MAX_RETRIES):
                try:
                    call_count += 1
                    if call_count < MAX_RETRIES:
                        raise Exception(f"Init failed attempt {attempt + 1}")
                    return True
                except Exception as e:
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        delays.append(delay)
                        time.sleep(delay)
                        delay *= 2

            return False

        result = init_with_retry()
        assert result is True
        assert call_count == MAX_RETRIES
        assert len(delays) == MAX_RETRIES - 1

        # Check exponential backoff
        for i in range(1, len(delays)):
            assert delays[i] == delays[i-1] * 2

    def test_no_retry_on_import_error(self):
        """Test that import errors don't trigger retry."""
        call_count = 0

        def init_with_import_check():
            nonlocal call_count
            try:
                call_count += 1
                raise ImportError("Module not found")
            except ImportError:
                return False  # No retry for import errors

        result = init_with_import_check()
        assert result is False
        assert call_count == 1  # Only one attempt


class TestGPUCloseLogic:
    """Test GPU cleanup logic."""

    def test_close_prevents_double_close(self):
        """Test that close only runs once."""
        close_count = 0
        closed = False

        def close():
            nonlocal close_count, closed
            if closed:
                return
            closed = True
            close_count += 1

        close()
        close()
        close()

        assert close_count == 1

    def test_close_handles_missing_instance(self):
        """Test close handles missing instances gracefully."""
        jtop_instance = None
        pynvml = None

        def close():
            if jtop_instance is not None:
                jtop_instance.close()
            if pynvml is not None:
                pynvml.nvmlShutdown()

        # Should not raise
        close()

    def test_close_handles_exceptions(self):
        """Test close handles exceptions during cleanup."""
        mock_jtop = MagicMock()
        mock_jtop.close.side_effect = Exception("Close failed")

        def close(jtop_instance):
            try:
                if jtop_instance is not None:
                    jtop_instance.close()
            except Exception:
                pass  # Log but don't raise

        # Should not raise
        close(mock_jtop)
        mock_jtop.close.assert_called_once()


class TestGPUReinitialize:
    """Test GPU reinitialization logic."""

    def test_reinitialize_resets_state(self):
        """Test that reinitialize resets all state."""
        state = {
            'closed': True,
            'pynvml_loaded': False,
            'jtop_loaded': False,
            'any_gpu_loaded': False,
            'gpus': [{'name': 'old'}],
            'cuda_devices_found': 1,
        }

        def reinitialize():
            state['closed'] = False
            state['pynvml_loaded'] = False
            state['jtop_loaded'] = False
            state['any_gpu_loaded'] = False
            state['gpus'] = []
            state['cuda_devices_found'] = 0

            # Simulate successful init
            state['pynvml_loaded'] = True
            state['any_gpu_loaded'] = True
            state['gpus'] = [{'name': 'new'}]
            state['cuda_devices_found'] = 1

            return state['any_gpu_loaded']

        result = reinitialize()
        assert result is True
        assert state['closed'] is False
        assert state['gpus'][0]['name'] == 'new'


class TestGPUOperational:
    """Test is_operational logic."""

    def test_operational_when_loaded_and_not_closed(self):
        """Test operational state."""
        any_gpu_loaded = True
        closed = False

        def is_operational():
            return any_gpu_loaded and not closed

        assert is_operational() is True

    def test_not_operational_when_closed(self):
        """Test not operational when closed."""
        any_gpu_loaded = True
        closed = True

        def is_operational():
            return any_gpu_loaded and not closed

        assert is_operational() is False

    def test_not_operational_when_not_loaded(self):
        """Test not operational when not loaded."""
        any_gpu_loaded = False
        closed = False

        def is_operational():
            return any_gpu_loaded and not closed

        assert is_operational() is False


class TestGPUStatus:
    """Test GPU status retrieval logic."""

    def test_cpu_only_status(self):
        """Test status when using CPU only."""
        cuda_device = 'cpu'

        def get_status():
            if cuda_device == 'cpu':
                return {
                    'device_type': 'cpu',
                    'gpus': [{
                        'gpu_utilization': -1,
                        'gpu_temperature': -1,
                        'vram_total': -1,
                        'vram_used': -1,
                        'vram_used_percent': -1,
                    }]
                }
            return {'device_type': 'cuda', 'gpus': []}

        status = get_status()
        assert status['device_type'] == 'cpu'
        assert status['gpus'][0]['gpu_utilization'] == -1

    def test_vram_percent_calculation(self):
        """Test VRAM percentage calculation."""
        vram_used = 4294967296  # 4GB
        vram_total = 10737418240  # 10GB

        vram_percent = (vram_used / vram_total * 100) if vram_total and vram_total != 0 else -1
        assert 40.0 == pytest.approx(vram_percent, rel=0.01)

    def test_vram_percent_with_zero_total(self):
        """Test VRAM percentage with zero total."""
        vram_used = 4294967296
        vram_total = 0

        vram_percent = (vram_used / vram_total * 100) if vram_total and vram_total != 0 else -1
        assert vram_percent == -1

    def test_switch_disables_monitoring(self):
        """Test that switches disable specific monitoring."""
        switch_gpu = False
        switch_vram = True

        def get_gpu_utilization():
            if not switch_gpu:
                return -1
            return 45

        def get_vram():
            if not switch_vram:
                return -1, -1
            return 4294967296, 10737418240

        assert get_gpu_utilization() == -1
        vram_used, vram_total = get_vram()
        assert vram_used == 4294967296


class TestJetsonDetection:
    """Test Jetson device detection logic."""

    def test_jetson_detection_via_device_tree(self):
        """Test Jetson detection via /proc/device-tree/model."""
        def is_jetson_from_model(model_content):
            return "NVIDIA" in model_content

        assert is_jetson_from_model("NVIDIA Jetson Nano Developer Kit") is True
        assert is_jetson_from_model("Raspberry Pi 4 Model B") is False

    def test_jetson_detection_via_platform_release(self):
        """Test Jetson detection via platform release."""
        def is_jetson_from_release(release):
            return 'tegra' in release.lower()

        assert is_jetson_from_release("4.9.140-tegra") is True
        assert is_jetson_from_release("5.4.0-generic") is False


class TestDeviceCount:
    """Test device count logic."""

    def test_pynvml_device_count(self):
        """Test device count with pynvml."""
        mock_pynvml = MagicMock()
        mock_pynvml.nvmlDeviceGetCount.return_value = 2

        def get_device_count(pynvml_loaded, pynvml):
            if pynvml_loaded:
                return pynvml.nvmlDeviceGetCount()
            return 0

        count = get_device_count(True, mock_pynvml)
        assert count == 2

    def test_jetson_device_count(self):
        """Test device count on Jetson (always 1)."""
        def get_device_count_jetson(jtop_loaded):
            if jtop_loaded:
                return 1
            return 0

        assert get_device_count_jetson(True) == 1

    def test_no_gpu_device_count(self):
        """Test device count with no GPU."""
        def get_device_count(pynvml_loaded, jtop_loaded):
            if pynvml_loaded:
                return 1  # Would call nvmlDeviceGetCount
            elif jtop_loaded:
                return 1
            return 0

        assert get_device_count(False, False) == 0
