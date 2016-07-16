// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: under development, not stable

function FaviconService() {
  this.timeout = null;
  this.cache = null;
  this.minLength = 50;
  this.maxLength = 10000;
}

// Looks up the associated icon url and passes it to the callback. If no icon
// is found, passes undefined to the callback.
// If forceReload is true, the remote file is rechecked despite being cached.
FaviconService.prototype.lookup = function(url, forceReload, callback) {

  const context = {
    'url': url,
    'forceReload': forceReload,
    'callback': callback,
    'connection': null,
    'entry': null
  };


  if(this.cache) {
    this.cache.connect(this._lookupOnConnect.bind(this, context));
  } else {
    this.fetchDocument(context);
  }
};

FaviconService.prototype._lookupOnConnect = function(context, event) {

  if(event.type !== 'success') {
    console.debug('Cache connection error:', event);
    this.fetchDocument(context);
    return;
  }

  console.debug('Connected to', this.cache.name);
  context.connection = event.target.connection;
  this.cache.findByPageURL(context, this._onFindByURL.bind(this, context));
};

FaviconService.prototype._onFindByURL = function(context, event) {

  if(event.type !== 'success') {
    console.debug('Cache error', event);
    context.connection.close();
    context.callback();
    return;
  }

  context.entry = event.target.result;

  if(context.entry) {
    console.debug('Cache hit', context.url.href, context.entry.iconURLString);

    if(context.forceReload) {
      // We found a cache hit, but still want to check online
      this.fetchDocument(context);
    } else {
      // We found a cache hit, and are done
      context.connection.close();
      const iconURL = new URL(context.entry.iconURLString);
      context.callback(iconURL);
      return;
    }
  }

  console.debug('Cache miss', context.url.href);
  this.fetchDocument(context);
};

FaviconService.prototype.fetchDocument = function(context) {

  console.debug('GET', context.url.href);

  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Fetch error: offline');

    if(this.cache && context.connection) {
      context.connection.close();
    }

    if(context.entry) {
      // We are offline, but we had a cache hit earlier, so use that
      const iconURL = new URL(context.entry.iconURLString);
      context.callback(iconURL);
    } else {
      // We are offline, and had a cache miss, callback with nothing
      context.callback();
    }

    return;
  }

  const onFetch = this._onFetchDocument.bind(this, context);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = onFetch;
  request.ontimeout = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('GET', url.href, isAsync);
  request.send();
};

FaviconService.prototype._onFetchDocument = function(context, event) {

  if(event.type !== 'load') {
    console.debug('Fetch error', event.type, context.url.href);
    this.findIconInDomainRoot(context);
    return;
  }

  const document = event.target.responseXML;
  if(!document) {
    console.debug('Fetch error: undefined document for', context.url.href);
    this.findIconInDomainRoot(context);
    return;
  }

  const responseURL = new URL(event.target.responseURL);

  // TODO: link elements can also have a type attribute that is a string
  // of the mime type. At the very least I can restrict to certain types or
  // blacklist some types if a type attribute is present. E.g. I can avoid
  // a stylesheet if someone used the wrong rel attribute value but the right
  // type value.

  const selectors = [
    'head > link[rel="icon"][href]',
    'head > link[rel="shortcut icon"][href]',
    'head > link[rel="apple-touch-icon"][href]',
    'head > link[rel="apple-touch-icon-precomposed"][href]'
  ];

  let linkURL = null;
  for(let i = 0, len = selectors.length; !linkURL && i < len; i++) {
    linkURL = this.findURLInPage(document, selectors[i], responseURL);
  }

  // TODO: add another fallback here maybe, look at all link urls for the
  // presence of the word 'favicon' (case insensitive)

  // TODO: if one of the urls is found, is it worth sending out another request
  // to verify the url is reachable?
  if(linkURL) {
    console.debug('Found in page url:', linkURL.href);

    // Check both are defined. Cache may be assigned but connection is null
    // when disconnected.
    // TODO: instead of checking if defined, maybe require always defined
    // and actually use the properties (e.g. connection.isConnected or whatever
    // it is)

    // TODO: this may occur after a cache hit with forceReload on, meaning that
    // the add will fail. So instead the add should be a put or an update or
    // something to that effect. Really all we are doing I think is changing
    // delaying the expiration date more.

    if(this.cache && context.connection) {
      this.cache.addEntry(context.connection, url, linkURL);
      context.connection.close();
    }

    context.callback(linkURL);
    return;
  }

  console.debug('Did not find in page icon url for', responseURL.href);

  // Look for the icon in the root of the response url, not the input url,
  // in the event of a redirect
  // actually that isn't right. we cannot use the redirect url, otherwise all
  // future find queries fail. however, i should somehow be taking advantage
  // of the fact that the redirect is now known. like, if the two urls are
  // different, i should be storing an entry for each, or something like
  // that.
  this.findIconInDomainRoot(context);
};

// Searches for the favicon url in the contents of an HTML document, and if
// found and appears valid (no parsing errors), returns the absolute form of
// the url.
//
// This expects a base url object because the in document url may be relative.
// I did not check if whether the fact that urls can be relative is actually
// true in the spec, but I once observed it in some reference implementation I
// found. This returns the absolute form of the url. Using a URL object instead
// of a string also provides url normalization. Creating the url object here
// also minimizes the scope of the try/catch statement which otherwise causes a
// deoptimization.
FaviconService.prototype.findURLInPage = function(document, selector,
  baseURL) {

  let element = document.querySelector(selector);
  if(!element) {
    return;
  }

  let href = element.getAttribute('href');
  if(!href) {
    return;
  }

  href = href.trim();
  if(!href) {
    return;
  }

  try {
    return new URL(href, baseURL);
  } catch(exception) {}
};

// Send a HEAD request to check for the favicon.ico file
// TODO: instead of a function specifically for root, this should be a general
// function for any icon url, which the caller happens to use the path to the
// root for.
FaviconService.prototype.findIconInDomainRoot = function(context) {

  const onFetch = this._onFindIconInDomainRoot.bind(this, context);
  const isAsync = true;

  const requestURLString = context.url.origin + '/favicon.ico';
  console.debug('HEAD', requestURLString);

  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.ontimeout = onFetch;
  request.onerror = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('HEAD', requestURLString, isAsync);

  //https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html
  request.setRequestHeader('Accept', 'image/*');

  request.send();
};


// TODO: look at status code, maybe can restrict to 200?
FaviconService.prototype._onFindIconInDomainRoot = function(context, event) {

  if(event.type !== 'load') {
    console.debug('HEAD response error', event);

    if(this.cache && context.connection) {
      context.connection.close();
    }

    // If entry is defined we are in a forceReload context and had a cache hit
    // so fallback to using the prior value.
    // TODO: although this might be wrong actually. if we fail to fetch and it
    // is the same url, that may mean the url no longer exists/is valid?
    // so what we actually should be doing is removing the entry? even though
    // we cannot tell the difference between temporarily unavailable and
    // permanently removed. i think i need another cache function to remove
    // entries. I should be doing that here I think.
    if(entry) {
      const entryIconURL = new URL(entry.iconURLString);
      context.callback(entryIconURL);
    } else {
      context.callback();
    }

    return;
  }

  const iconURL = new URL(event.target.responseURL);
  console.debug('Found possible favicon in root', iconURL.href);
  // console.debug('Response status:', event.target.status);

  const contentLengthString = event.target.getResponseHeader('Content-Length');
  if(contentLengthString) {
    let numBytes = 0;

    try {
      numBytes = parseInt(contentLengthString, 10);
    } catch(exception) {
      console.debug('Error parsing Content-Length: ', contentLengthString);
    }

    if(numBytes < this.minLength || numBytes > this.maxLength) {
      console.debug('Icon content length is out of bounds', numBytes);
      if(this.cache && context.connection) {
        context.connection.close();
      }
      context.callback();
      return;
    }
  }

  const contentType = event.target.getResponseHeader('Content-Type');
  if(contentType && !/image\//i.test(contentType)) {
    console.debug('Invalid content type:', contentType);
    if(this.cache && context.connection) {
      context.connection.close();
    }
    context.callback();
    return;
  }


  // TODO: this should be caching the domain url, not the page url, right?
  // TODO: i should be checking the cache for the domain root as well before
  // even trying to fetch it.

  if(this.cache && context.connection) {
    this.cache.addEntry(context.connection, context.url, iconURL);
    context.connection.close();
  }

  context.callback(iconURL);
};

///////////////////////////////////////////////

function FaviconDummyCache(name) {
  this.name = name;
}

FaviconDummyCache.prototype.connect = function(callback) {
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

FaviconDummyCache.prototype.findByPageURL = function(connection, url,
  callback) {
  console.debug('Finding', url.href);
  const event = {};
  event.type = 'success';
  event.target = {};
  event.target.result = null;
  callback(event);
};

FaviconDummyCache.prototype.addEntry = function(connection, pageURL, iconURL) {
  console.debug('Caching', pageURL.href, iconURL.href);
};

///////////////////////////////////////////////

function FaviconIDBCache(name) {
  this.name = name || 'favicon-cache';
  this.version = 1;
}


FaviconIDBCache.prototype.connect = function(callback) {
  console.debug('Connecting to database', this.name, this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this.upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

FaviconIDBCache.prototype.upgrade = function(event) {
  console.log('Upgrading database', this.name);

  const connection = event.target.result;
  const transaction = event.target.transaction;
  const stores = connection.objectStoreNames;

  let cacheStore = null;
  if(stores.contains('favicon-cache')) {
    cacheStore = transaction.objectStore('favicon-cache');
  } else {
    cacheStore = connection.createObjectStore('favicon-cache', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const indices = cacheStore.indexNames;
  if(!indices.contains('page-url')) {
    cacheStore.createIndex('page-url', 'pageURLString', {
      'unique': true
    });
  }
};

FaviconIDBCache.prototype.reset = function(callback) {
  console.log('Clearing database', this.name);

  this.connect(function(event) {
    if(event.type !== 'success') {
      callback(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    transaction.oncomplete = callback;
    const store = transaction.objectStore('favicon-cache');
    store.clear();
    connection.close();
  });
};

// Apply further normalizations to urls. Returns a new url object, does not
// modify its input.
FaviconIDBCache.prototype.normalizeURL = function(url) {
  const outputURL = this.cloneURL(url);
  if(outputURL.hash) {
    outputURL.hash = '';
  }
  return outputURL;
};

FaviconIDBCache.prototype.cloneURL = function(url) {
  return new URL(url.href);
};

FaviconIDBCache.prototype.findByPageURL = function(connection,
  url, callback) {
  console.debug('Finding', url.href);
  let pageURLString = this.normalizeURL(url).href;
  const transaction = connection.transaction('favicon-cache');
  const cacheStore = transaction.objectStore('favicon-cache');
  const urlIndex = cacheStore.index('page-url');
  const getRequest = urlIndex.get(pageURLString);
  getRequest.onsuccess = callback;
  getRequest.onerror = callback;
};

FaviconIDBCache.prototype.addEntry = function(connection, pageURL,
  iconURL) {
  console.debug('Caching', pageURL.href, iconURL.href);
  const entry = Object.create(null);
  entry.pageURLString = this.normalizeURL(pageURL).href;
  entry.iconURLString = iconURL.href;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.add(entry);
};
