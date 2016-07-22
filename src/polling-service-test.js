'use strict';

function testPollingService() {
  const debugLogger = new LoggingService(LoggingService.LEVEL_DEBUG);
  const faviconCache = new FaviconCache('favicon-cache');
  faviconCache.log = debugLogger;
  const faviconService = new FaviconService(faviconCache);
  faviconService.log = debugLogger;
  const imageDimensionsService = new ImageDimensionsService();
  imageDimensionsService.log = debugLogger;
  const pollService = new PollingService();
  pollService.log = debugLogger;
  pollService.faviconService = faviconService;
  pollService.imageDimensionsService = imageDimensionsService;
  pollService.start();
}
