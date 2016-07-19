
'use strict';

function testFaviconServiceLookup(pageURLString) {

  const service = new FaviconService();
  service.timeout = 5000;

  //const cache = new FaviconCache('test-favicon-service');
  const cache = new FaviconTestCache('test-dummy-cache');
  service.cache = cache;

  const pageURL = new URL(pageURLString);
  const forceReload = false;
  service.lookup(pageURL, forceReload, onLookup);

  function onLookup(iconURL) {
    console.log(iconURL ? 'Favicon url: ' + iconURL.href : 'No favicon found');
  }
}

// NOTE: does not deal with dups in the same way as other implementation
// NOTE: does not normalize url fragments

function FaviconTestCache(name) {
  this.name = name;
  this.store = [];
}

FaviconTestCache.prototype.connect = function(callback) {
  console.debug('Opening connection');
  const event = {};
  event.type = 'success';
  event.target = {};
  event.target.connection = {};
  event.target.connection.close = function() {
    console.debug('Closing connection');
  };
  callback(event);
};

FaviconTestCache.prototype.findByPageURL = function(context, callback) {
  console.debug('Finding', context.url.href);
  const event = {};
  event.type = 'success';
  event.target = {};
  event.target.result = null;

  for(let entry of this.store) {
    if(entry.pageURLString === context.url.href) {
      event.target.result = entry;
      break;
    }
  }

  callback(event);
};

FaviconTestCache.prototype.addEntry = function(connection, pageURL,
  iconURL) {
  console.debug('Caching', pageURL.href, iconURL.href);
  const entry = {
    'pageURLString': pageURL.href,
    'iconURLString': iconURL.href,
    'dateUpdated': new Date()
  };
  const store = connection.store;
  store.push(entry);
};
