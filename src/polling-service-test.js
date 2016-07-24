'use strict';

function testPollingService() {
  const pollService = new PollingService();
  pollService.log.level = LoggingService.LEVEL_DEBUG;
  pollService.faviconService.log.level = LoggingService.LEVEL_OFF;
  pollService.faviconService.cache.log.level = LoggingService.LEVEL_OFF;
  pollService.imageDimensionsService.log.level = LoggingService.LEVEL_OFF;
  pollService.feedCache.log.level = LoggingService.LEVEL_OFF;
  pollService.badgeUpdateService.log.level = LoggingService.LEVEL_OFF;
  pollService.fetchFeedService.log.level = LoggingService.LEVEL_OFF;
  pollService.start();
}
