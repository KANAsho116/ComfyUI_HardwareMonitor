from server import PromptServer
from aiohttp import web
from ..core import logger
from ..general import cmonitor


def _validate_boolean_field(settings, field_name):
    if field_name in settings and settings[field_name] is not None:
        field_value = settings[field_name]
        if not isinstance(field_value, bool):
            raise Exception(f'{field_name} must be a boolean.')
        return field_value
    return None


def _validate_gpu_index(index):
    try:
        gpu_index = int(index)
    except ValueError:
        raise Exception('Invalid GPU index')

    if not (0 <= gpu_index < len(cmonitor.hardwareInfo.GPUInfo.gpus)):
        raise Exception('Invalid GPU index')

    return gpu_index

@PromptServer.instance.routes.patch("/crystools/monitor")
async def newSettings(request):
    try:
        settings = await request.json()
        # print(settings)

        if 'rate' in settings and settings['rate'] is not None:
            rate = settings['rate']
            if not isinstance(rate, (int, float)):
                raise Exception('Rate must be a number.')

            if cmonitor.rate == 0 and rate > 0:
                cmonitor.rate = rate
                cmonitor.startMonitor()
            else:
                cmonitor.rate = rate


        if 'switchCPU' in settings and settings['switchCPU'] is not None:
            switchCPU = _validate_boolean_field(settings, 'switchCPU')
            cmonitor.hardwareInfo.switchCPU = switchCPU

        if 'switchRAM' in settings and settings['switchRAM'] is not None:
            switchRAM = _validate_boolean_field(settings, 'switchRAM')
            cmonitor.hardwareInfo.switchRAM = switchRAM

        if 'switchTransferSpeed' in settings and settings['switchTransferSpeed'] is not None:
            switchTransferSpeed = _validate_boolean_field(settings, 'switchTransferSpeed')
            cmonitor.hardwareInfo.switchTransferSpeed = switchTransferSpeed

        if 'switchSharedGPUMemory' in settings and settings['switchSharedGPUMemory'] is not None:
            switchSharedGPUMemory = _validate_boolean_field(settings, 'switchSharedGPUMemory')
            cmonitor.hardwareInfo.switchSharedGPUMemory = switchSharedGPUMemory

        return web.Response(status=200)
    except Exception as e:
        logger.error(e)
        return web.Response(status=400, text=str(e))


@PromptServer.instance.routes.post("/crystools/monitor/switch")
async def monitorSwitch(request):
    try:
        switch = await request.json()

        if 'monitor' in switch and switch['monitor'] is not None:
            monitor = switch['monitor']
            if not isinstance(monitor, bool):
                raise Exception('monitor must be a boolean.')

            if monitor:
                cmonitor.startMonitor()
            else:
                cmonitor.stopMonitor()

        return web.Response(status=200)
    except Exception as e:
        logger.error(e)
        return web.Response(status=400, text=str(e))


@PromptServer.instance.routes.get("/crystools/monitor/GPU")
def getGPUs(request):
    try:
        gpuInfo = cmonitor.hardwareInfo.getGPUInfo()
        return web.json_response(gpuInfo)
    except Exception as e:
        logger.error(e)
        return web.Response(status=400, text=str(e))


@PromptServer.instance.routes.get("/crystools/monitor/TransferSpeed")
def getTransferSpeedInfo(request):
    try:
        transferSpeedInfo = cmonitor.hardwareInfo.getTransferSpeedInfo()
        return web.json_response(transferSpeedInfo)
    except Exception as e:
        logger.error(e)
        return web.Response(status=400, text=str(e))


@PromptServer.instance.routes.patch("/crystools/monitor/GPU/{index}")
async def getGPUs(request):
  try:
    index = _validate_gpu_index(request.match_info["index"])
    settings = await request.json()
    if 'utilization' in settings and settings['utilization'] is not None:
      cmonitor.hardwareInfo.GPUInfo.gpusUtilization[index] = _validate_boolean_field(settings, 'utilization')

    if 'vram' in settings and settings['vram'] is not None:
      cmonitor.hardwareInfo.GPUInfo.gpusVRAM[index] = _validate_boolean_field(settings, 'vram')

    if 'temperature' in settings and settings['temperature'] is not None:
      cmonitor.hardwareInfo.GPUInfo.gpusTemperature[index] = _validate_boolean_field(settings, 'temperature')

    return web.Response(status=200)
  except Exception as e:
    logger.error(e)
    return web.Response(status=400, text=str(e))
