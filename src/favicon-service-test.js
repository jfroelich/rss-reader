
'use strict';

const faviconTestCache = new FaviconTestCache('test-dummy-cache');
const faviconTestService = new FaviconService();
faviconTestService.timeout = 5000;
faviconTestService.cache = faviconTestCache;
// faviconTestService.expiresAfterMillis = 5;

function testFaviconServiceLookup(pageURLString) {
  faviconTestService.lookup(new URL(pageURLString), null, function(iconURL) {
    console.log(iconURL ? 'Favicon url: ' + iconURL.href : 'No favicon found');
  });
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
