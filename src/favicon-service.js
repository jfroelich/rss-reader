// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function FaviconService(cache) {
  this.timeout = null;
  this.cache = cache;
  this.minLength = 50;
  this.maxLength = 10000;
  this.expiresAfterMillis = 1000 * 60 * 60 * 24 * 30;
  this.log = new DummyLoggingService();
}

FaviconService.prototype.lookup = function(url, document, callback) {
  this.log.debug('Looking up', url.href);

  const context = {
    'url': url,
    'callback': callback,
    'connection': null,
    'entry': null
  };

  if(this.cache) {
    this.log.debug('Detected favicon service cache', this.cache.name);
    this.cache.connect(onConnect.bind(this));
  } else if(document) {
    const iconURL = this.findIconURLInDocument(document, url);
    if(iconURL) {
      this.log.debug(
        'Found favicon in pre-fetched document without available cache',
        iconURL.href);
      callback(iconURL);
    } else {
      this.log.debug(
        'Did not find favicon in pre-fetched document without available cache');
      this.fetchDocument(context);
    }
  } else {
    this.log.debug(
      'No cache detected, no pre-fetched document available, ' +
      'falling back to fetching');
    this.fetchDocument(context);
  }

  function onConnect(connection) {
    if(connection) {
      context.connection = connection;
      if(document) {
        const iconURL = this.findIconURLInDocument(document, url);
        if(iconURL) {
          this.log.debug('Found icon in pre-fetched document, caching',
            url.href, iconURL.href);

          this.cache.addEntry(connection, url, iconURL);
          callback(iconURL);
        } else {
          this.log.debug(
            'Did not find icon in pre-fetched document, searching cache');
          this.cache.findByPageURL(connection, context.url,
            onFindByURL.bind(this));
        }
      } else {
        this.log.debug('No pre-fetched document available, searching cache');
        this.cache.findByPageURL(context.connection, context.url,
          onFindByURL.bind(this));
      }
    } else if(document) {
      const iconURL = this.findIconURLInDocument(document, url);
      if(iconURL) {
        this.log.debug('Connection error but found icon in prefetched document',
          url.href, iconURL.href);
        callback(iconURL);
      } else {
        this.log.debug(
          'Connection error, did not find icon in prefetched document');
        this.fetchDocument(context);
      }
    } else {
      this.log.error('Cache connection error, falling back to fetch');
      this.fetchDocument(context);
    }
  }

  function onFindByURL(entry) {
    if(entry && !this.isEntryExpired(entry)) {
      this.log.debug('Found non-expired entry for', context.url.href);
      context.connection.close();
      const iconURL = new URL(entry.iconURLString);
      context.callback(iconURL);
    } else {
      this.log.debug('Did not find non-expired entry for', context.url.href);
      context.entry = entry;
      this.fetchDocument(context);
    }
  }
};

FaviconService.prototype.isEntryExpired = function(entry) {
  return (new Date() - entry.dateUpdated) >= this.expiresAfterMillis;
};

FaviconService.prototype.fetchDocument = function(context) {
  this.log.debug('Fetching', context.url.href);

  if('onLine' in navigator && !navigator.onLine) {
    if(context.connection) {
      context.connection.close();
    }

    // context.entry will be defined when he had a cache hit but the entry was
    // expired so we still tried to fetch. since we can't fetch, fallback to
    // using the last known association.
    if(context.entry) {
      const iconURL = new URL(context.entry.iconURLString);
      context.callback(iconURL);
    } else {
      context.callback();
    }
    return;
  }

  const boundOnFetch = onFetchPage.bind(this);
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = boundOnFetch;
  request.ontimeout = boundOnFetch;
  request.onabort = boundOnFetch;
  request.onload = boundOnFetch;
  request.open('GET', context.url.href, true);
  request.setRequestHeader('Accept', 'text/html');
  request.send();

  function onFetchPage(event) {
    this.log.debug('Fetched', context.url.href);

    if(event.type === 'load') {
      const document = event.target.responseXML;
      const responseURL = new URL(event.target.responseURL);
      if(document) {
        const inPageIconURL = this.findIconURLInDocument(document, responseURL);
        if(inPageIconURL) {
          this.log.debug('Found icon url in page', inPageIconURL.href);

          if(this.cache && context.connection) {
            this.cache.addEntry(context.connection, context.url, inPageIconURL);
            if(responseURL.href !== context.url.href) {
              this.cache.addEntry(context.connection, responseURL,
                inPageIconURL);
            }
            context.connection.close();
          }
          context.callback(inPageIconURL);
        } else {
          this.log.debug('No icons in page', context.url.href);
          this.lookupPageResponseURL(context, new URL(responseURL));
        }
      } else {
        this.log.debug('Undefined document for', context.url.href);
        this.lookupPageResponseURL(context, new URL(responseURL));
      }
    } else {
      this.log.debug('Error fetching', context.url.href);
      // Ensure this page is no longer in the cache
      // TODO: Is this right?
      if(this.cache && context.connection && context.entry) {
        this.cache.deleteByPageURL(context.connection, context.url);
      }
      this.lookupOrigin(context, null);
    }
  }
};

FaviconService.prototype.lookupPageResponseURL = function(context,
  pageResponseURL) {

  if(this.cache && context.connection && pageResponseURL &&
    pageResponseURL.href !== context.url.href) {
    this.log.debug('Redirected, checking cache for', pageResponseURL.href);
    this.cache.findByPageURL(context.connection, pageResponseURL,
      onLookupResponseURL.bind(this));
  } else {
    this.lookupOrigin(context, pageResponseURL);
  }

  function onLookupResponseURL(entry) {
    this.log.debug('Finished looking up if redirect url in cache');

    if(entry && !this.isEntryExpired(entry)) {
      this.log.debug('Redirect cache hit', pageResponseURL.href);
      context.connection.close();
      context.callback(new URL(entry.iconURLString));
    } else {
      this.log.debug('Redirect cache miss', pageResponseURL.href);
      this.lookupOrigin(context, pageResponseURL);
    }
  }
};

FaviconService.prototype.findIconURLInDocument = function(document, baseURL) {
  this.log.debug('Searching for icon in document with base url', baseURL.href);

  const selectors = [
    'head > link[rel="icon"][href]',
    'head > link[rel="shortcut icon"][href]',
    'head > link[rel="apple-touch-icon"][href]',
    'head > link[rel="apple-touch-icon-precomposed"][href]'
  ];

  for(let selector of selectors) {
    const element = document.querySelector(selector);
    if(element) {
      const href = element.getAttribute('href');
      if(href) {
        try {
          this.log.debug('Matched element', element.outerHTML);
          const iconURL = new URL(href, baseURL);
          return iconURL;
        } catch(exception) {
          this.log.debug(exception);
        }
      }
    }
  }
};

FaviconService.prototype.lookupOrigin = function(context, pageResponseURL) {

  const originURL = new URL(context.url.origin);
  const originIconURL = new URL(context.url.origin + '/favicon.ico');

  if(this.cache && context.connection && originURL.href !== context.url.href &&
    (!pageResponseURL || pageResponseURL.href !== originURL.href)) {
    this.log.debug('Searching cache for origin', originURL.href);
    this.cache.findByPageURL(context.connection, originURL,
      onLookupOrigin.bind(this));
  } else {
    this.log.debug(
      'Not searching cache for origin, requesting icon in origin');
    this.sendImageHeadRequest(originIconURL,
      this.onRequestOrigin.bind(this, context, pageResponseURL));
  }

  function onLookupOrigin(entry) {
    this.log.debug('Finished looking for origin in cache');

    if(entry && !this.isEntryExpired(entry)) {
      this.log.debug('Found origin in cache');
      const iconURL = new URL(entry.iconURLString);
      if(context.url.href !== context.url.origin) {
        this.cache.addEntry(context.connection, context.url, iconURL);
      }

      context.connection.close();
      context.callback(iconURL);
    } else {
      this.log.debug('Did not find origin url in cache, sending HEAD request');
      this.sendImageHeadRequest(originIconURL,
        this.onRequestOrigin.bind(this, context, pageResponseURL));
    }
  }
};

FaviconService.prototype.sendImageHeadRequest = function(imageURL, callback) {
  this.log.debug('Sending image head request for', imageURL.href);
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.ontimeout = callback;
  request.onerror = callback;
  request.onabort = callback;
  request.onload = callback;
  request.open('HEAD', imageURL.href, true);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
};

FaviconService.prototype.onRequestOrigin = function(context, pageResponseURL,
  event) {
  const originURL = new URL(context.url.origin);
  this.log.debug('Possibly fetched', context.url.origin + '/favicon.ico');
  const contentLength = event.target.getResponseHeader('Content-Length');
  const contentType = event.target.getResponseHeader('Content-Type');

  if(event.type === 'load' && this.isContentLengthInRange(contentLength) &&
    this.isMimeTypeImage(contentType)) {
    const iconURL = new URL(event.target.responseURL);
    if(this.cache && context.connection) {
      this.cache.addEntry(context.connection, context.url, iconURL);
      if(pageResponseURL && pageResponseURL.href !== context.url.href) {
        this.cache.addEntry(context.connection, pageResponseURL, iconURL);
      }

      if(originURL.href !== context.url.href) {
        if(pageResponseURL && originURL.href !== pageResponseURL.href) {
          this.cache.addEntry(context.connection, originURL, iconURL);
        }
      }

      context.connection.close();
      context.callback(iconURL);
    }
  } else {
    const originURL = new URL(context.url.origin);
    this.log.debug('Error fetching', context.url.origin + '/favicon.ico');
    if(this.cache && context.connection) {
      this.cache.deleteByPageURL(context.connection, context.url);
      if(pageResponseURL && pageResponseURL.href !== context.url.href) {
        this.cache.deleteByPageURL(context.connection, pageResponseURL);
      }

      if(originURL.href !== context.url.href) {
        this.cache.deleteByPageURL(context.connection, originURL);
      }

      context.connection.close();
    }

    context.callback();
  }
};

FaviconService.prototype.isContentLengthInRange =
  function(contentLengthString) {
  try {
    const numBytes = parseInt(contentLengthString, 10);
    return numBytes >= this.minLength && numBytes <= this.maxLength;
  } catch(exception) {
    this.log.debug(exception);
  }
};

FaviconService.prototype.isMimeTypeImage = function(mimeTypeString) {
  return /^\s*image\//i.test(mimeTypeString);
};
