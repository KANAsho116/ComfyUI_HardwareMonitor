from server import PromptServer
from aiohttp import web
from ..core import logger
from ..general import cmonitor

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
            switchCPU = settings['switchCPU']
            if not isinstance(switchCPU, bool):
                raise Exception('switchCPU must be a boolean.')

            cmonitor.hardwareInfo.switchCPU = switchCPU

        if 'switchRAM' in settings and settings['switchRAM'] is not None:
            switchRAM = settings['switchRAM']
            if not isinstance(switchRAM, bool):
                raise Exception('switchRAM must be a boolean.')

            cmonitor.hardwareInfo.switchRAM = switchRAM

        if 'switchTransferSpeed' in settings and settings['switchTransferSpeed'] is not None:
            switchTransferSpeed = settings['switchTransferSpeed']
            if not isinstance(switchTransferSpeed, bool):
                raise Exception('switchTransferSpeed must be a boolean.')

            cmonitor.hardwareInfo.switchTransferSpeed = switchTransferSpeed

        if 'switchSharedGPUMemory' in settings and settings['switchSharedGPUMemory'] is not None:
            switchSharedGPUMemory = settings['switchSharedGPUMemory']
            if not isinstance(switchSharedGPUMemory, bool):
                raise Exception('switchSharedGPUMemory must be a boolean.')

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
    index = request.match_info["index"]
    settings = await request.json()
    if 'utilization' in settings and settings['utilization'] is not None:
      if not isinstance(settings['utilization'], bool):
        raise Exception('utilization must be a boolean.')

      cmonitor.hardwareInfo.GPUInfo.gpusUtilization[int(index)] = settings['utilization']

    if 'vram' in settings and settings['vram'] is not None:
      if not isinstance(settings['vram'], bool):
        raise Exception('vram must be a boolean.')

      cmonitor.hardwareInfo.GPUInfo.gpusVRAM[int(index)] = settings['vram']

    if 'temperature' in settings and settings['temperature'] is not None:
      if not isinstance(settings['temperature'], bool):
        raise Exception('temperature must be a boolean.')

      cmonitor.hardwareInfo.GPUInfo.gpusTemperature[int(index)] = settings['temperature']

    return web.Response(status=200)
  except Exception as e:
    logger.error(e)
    return web.Response(status=400, text=str(e))
