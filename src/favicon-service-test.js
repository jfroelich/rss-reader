
'use strict';

let service = null;

window.addEventListener('DOMContentLoaded', function(event) {
  service = new FaviconService();
  service.timeout = 5000;

  const cache = new FaviconCache('test-favicon-cache');
  service.cache = cache;

  const cacheLog = new LoggingService();
  cacheLog.level = LoggingService.LEVEL_DEBUG;
  cache.log = cacheLog;

  const serviceLog = new LoggingService();
  serviceLog.level = LoggingService.LEVEL_DEBUG;
  service.log = serviceLog;
});

function testFaviconServiceLookup(pageURLString) {
  service.lookup(new URL(pageURLString), null, testFaviconServiceOnLookup);
}

function testFaviconServiceOnLookup(iconURL) {
  console.log(iconURL ? 'Favicon url: ' + iconURL.href : 'No favicon found');
}

function FaviconTestCache(name) {
  this.name = name;
  this.store = [];
}

FaviconTestCache.prototype.connect = function(callback) {
  console.debug('Opening connection to', this.name);
  const connection = {
    'close': function() {
      console.debug('Closing connection');
    }
  };
  callback(connection);
};

FaviconTestCache.prototype.findByPageURL = function(connection, pageURL,
  callback) {
  console.debug('Searching cache for', pageURL.href);
  let result;
  for(let entry of this.store) {
    if(entry.pageURLString === pageURL.href) {
      result = entry;
      break;
    }
  }

  callback(result);
};

FaviconTestCache.prototype.addEntry = function(connection, pageURL,
  iconURL) {
  console.debug('Caching', pageURL.href, iconURL.href);
  this.store.push({
    'pageURLString': pageURL.href,
    'iconURLString': iconURL.href,
    'dateUpdated': new Date()
  });
};

FaviconTestCache.prototype.deleteByPageURL = function(connection, pageURL) {
  console.debug('Deleting', pageURL.href);
};
