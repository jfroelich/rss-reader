'use strict';

function testPollingService() {
  const logService = new LoggingService();
  logService.level = LoggingService.LEVEL_DEBUG;

  const pollService = new PollingService();
  pollService.log = logService;

  pollService.faviconService.log.level = LoggingService.LEVEL_DEBUG;

  pollService.start();
}
