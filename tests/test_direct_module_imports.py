import asyncio
import importlib
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch


REPO_ROOT = Path(__file__).resolve().parents[1]


def _install_fake_package_tree():
    pkg = types.ModuleType("ComfyUI_HardwareMonitor")
    pkg.__path__ = [str(REPO_ROOT)]

    general_pkg = types.ModuleType("ComfyUI_HardwareMonitor.general")
    general_pkg.__path__ = [str(REPO_ROOT / "general")]

    server_pkg = types.ModuleType("ComfyUI_HardwareMonitor.server")
    server_pkg.__path__ = [str(REPO_ROOT / "server")]

    core_pkg = types.ModuleType("ComfyUI_HardwareMonitor.core")
    core_pkg.logger = MagicMock()

    return {
        "ComfyUI_HardwareMonitor": pkg,
        "ComfyUI_HardwareMonitor.general": general_pkg,
        "ComfyUI_HardwareMonitor.server": server_pkg,
        "ComfyUI_HardwareMonitor.core": core_pkg,
    }


def _reload_module(module_name: str, extra_modules: dict | None = None):
    injected = _install_fake_package_tree()
    if extra_modules:
        injected.update(extra_modules)

    with patch.dict(sys.modules, injected, clear=False):
        sys.modules.pop(module_name, None)
        return importlib.import_module(module_name)


class TestTransferSpeedDirectImport:
    def test_get_speeds_returns_cache_when_measurement_raises(self):
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = True
        mock_torch.cuda.get_device_name.return_value = "Fake GPU"

        module = _reload_module(
            "ComfyUI_HardwareMonitor.general.transfer_speed",
            extra_modules={"torch": mock_torch, "pynvml": MagicMock()},
        )

        info = module.CTransferSpeedInfo(measurement_interval=0)
        info.switchTransferSpeed = True
        info._last_vram_speed = 123.0
        info._last_shared_speed = 456.0

        with patch.object(info, "measure_vram_speed", side_effect=RuntimeError("boom")):
            result = info.get_speeds()

        assert result == {"vram_speed": 123.0, "shared_gpu_speed": 456.0}
        assert info._consecutive_failures == 1

    def test_measure_vram_speed_retries_and_succeeds(self):
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = True
        mock_torch.cuda.get_device_name.return_value = "Fake GPU"

        module = _reload_module(
            "ComfyUI_HardwareMonitor.general.transfer_speed",
            extra_modules={"torch": mock_torch, "pynvml": MagicMock()},
        )

        info = module.CTransferSpeedInfo(measurement_interval=0)
        info.switchTransferSpeed = True

        with patch.object(
            info,
            "_measure_vram_speed_internal",
            side_effect=[RuntimeError("once"), 999.0],
        ):
            speed = info.measure_vram_speed()

        assert speed == 999.0


class TestSharedGpuMemoryDirectImport:
    def test_non_windows_returns_disabled_values(self):
        module = _reload_module(
            "ComfyUI_HardwareMonitor.general.shared_gpu_memory",
            extra_modules={"pynvml": MagicMock()},
        )

        with patch.object(module, "IS_WINDOWS", False):
            info = module.CSharedGPUMemoryInfo()
            info.switchSharedGPUMemory = True
            assert info.get_shared_gpu_memory_info() == {
                "shared_gpu_memory_used": -1,
                "shared_gpu_memory_total": -1,
                "shared_gpu_memory_percent": -1.0,
            }

    def test_completed_future_updates_cache(self):
        module = _reload_module(
            "ComfyUI_HardwareMonitor.general.shared_gpu_memory",
            extra_modules={"pynvml": MagicMock()},
        )

        with patch.object(module, "IS_WINDOWS", True):
            info = module.CSharedGPUMemoryInfo()
            info.switchSharedGPUMemory = True

            future = MagicMock()
            future.done.return_value = True
            future.result.return_value = (2048, 4096)
            info._pending_future = future
            info._query_in_progress = True

            with patch.object(info, "_should_query", return_value=False):
                result = info.get_shared_gpu_memory_info()

        assert result["shared_gpu_memory_used"] == 2048
        assert result["shared_gpu_memory_total"] == 4096
        assert result["shared_gpu_memory_percent"] == 50.0


class _FakeRoutes:
    def patch(self, _):
        return lambda func: func

    def post(self, _):
        return lambda func: func

    def get(self, _):
        return lambda func: func


class _FakePromptServer:
    instance = types.SimpleNamespace(routes=_FakeRoutes())




class _FakeResponse:
    def __init__(self, status=200, text=""):
        self.status = status
        self.text = text


class _FakeWeb:
    Response = _FakeResponse

    @staticmethod
    def json_response(data):
        return data


class _FakeRequest:
    def __init__(self, payload):
        self._payload = payload
        self.match_info = {"index": "0"}

    async def json(self):
        return self._payload


class TestServerMonitorDirectImport:
    def _import_monitor(self):
        fake_monitor = MagicMock()
        fake_monitor.rate = 0
        fake_monitor.hardwareInfo = MagicMock()

        fake_general = types.ModuleType("ComfyUI_HardwareMonitor.general")
        fake_general.__path__ = [str(REPO_ROOT / "general")]
        fake_general.cmonitor = fake_monitor

        module = _reload_module(
            "ComfyUI_HardwareMonitor.server.monitor",
            extra_modules={
                "server": types.SimpleNamespace(PromptServer=_FakePromptServer),
                "ComfyUI_HardwareMonitor.general": fake_general,
                "pynvml": MagicMock(),
                "aiohttp": types.SimpleNamespace(web=_FakeWeb),
            },
        )
        return module, fake_monitor

    def test_api_input_validation_returns_400(self):
        module, _ = self._import_monitor()

        response = asyncio.run(module.newSettings(_FakeRequest({"rate": "fast"})))

        assert response.status == 400
        assert response.text == "Rate must be a number."

    def test_monitor_restart_lifecycle_when_rate_resumes(self):
        module, fake_monitor = self._import_monitor()

        response = asyncio.run(module.newSettings(_FakeRequest({"rate": 1.5})))

        assert response.status == 200
        fake_monitor.startMonitor.assert_called_once()
        assert fake_monitor.rate == 1.5

    def test_shared_gpu_toggle_is_reflected_in_hardware_info(self):
        module, fake_monitor = self._import_monitor()

        response = asyncio.run(
            module.newSettings(_FakeRequest({"switchSharedGPUMemory": True}))
        )

        assert response.status == 200
        assert fake_monitor.hardwareInfo.switchSharedGPUMemory is True
