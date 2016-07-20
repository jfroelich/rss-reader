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
}

FaviconService.prototype.lookup = function(url, document, callback) {
  console.debug('Looking up', url.href);
  const context = {
    'url': url,
    'callback': callback,
    'connection': null,
    'entry': null
  };

  // TODO: Actually, if document is provided i shouldn't even necessarily bother
  // with connecting to the cache? But don't I want to establish a cache link so
  // I can store an entry so that lookups are successful later? I think I do
  // want to always try and connect.

  if(this.cache) {
    console.debug('Detected favicon service cache', this.cache.name);
    this.cache.connect(onConnect.bind(this));
  } else if(document) {
    // The caller provided a pre-fetched document and there is no cache
    // available. Look for icons in the page using the known url as the base
    // url before falling back to checking online.
    const iconURL = this.searchPageForFavicons(document, url);
    if(iconURL) {
      console.debug(
        'Found favicon in pre-fetched document without available cache',
        iconURL.href);
      callback(iconURL);
    } else {
      console.debug(
        'Did not find favicon in pre-fetched document without available cache');
      this.fetchDocument(context);
    }
  } else {
    console.debug(
      'No cache detected, no pre-fetched document avaialable, ' +
      'falling back to fetching');
    this.fetchDocument(context);
  }

  function onConnect(event) {
    if(event.type === 'success') {
      console.debug('Connected to cache', this.cache.name);
      context.connection = event.target.result;

      if(document) {
        // We connected. Before checking the cache, search the document.
        const iconURL = this.searchPageForFavicons(document, url);
        if(iconURL) {
          console.debug('Found icon in pre-fetched document, caching',
            url.href, iconURL.href);
          this.cache.addEntry(context.connection, url, iconURL);
          callback(iconURL);
        } else {
          console.debug(
            'Did not find icon in pre-fetched document, searching cache');
          this.cache.findByPageURL(context.connection, context.url,
            onFindByURL.bind(this));
        }
      } else {
        console.debug('No pre-fetched document available, searching cache');
        this.cache.findByPageURL(context.connection, context.url,
          onFindByURL.bind(this));
      }


    } else if(document) {
      // We failed to connect to the cache, but the caller provided a pre
      // fetched document. Before trying to fetch it, first check
      const iconURL = this.searchPageForFavicons(document, url);
      if(iconURL) {
        console.debug('Connection error but found icon in prefetched document',
          url.href, iconURL.href);
        callback(iconURL);
      } else {
        console.debug(
        'Connection error, did not find icon in prefetched document, fetching');
        this.fetchDocument(context);
      }

    } else {
      console.debug('Cache connection error, falling back to fetch');
      this.fetchDocument(context);
    }
  }

  function onFindByURL(event) {
    const result = event.target.result;
    if(event.type === 'success' && result && !this.isEntryExpired(result)) {
      console.debug('Found non-expired entry for', context.url.href);
      context.connection.close();
      const iconURL = new URL(result.iconURLString);
      context.callback(iconURL);
    } else {
      console.debug('Did not find non-expired entry for', context.url.href);
      context.entry = result;
      this.fetchDocument(context);
    }
  }
};

FaviconService.prototype.isEntryExpired = function(entry) {
  return (new Date() - entry.dateUpdated) >= this.expiresAfterMillis;
};

FaviconService.prototype.fetchDocument = function(context) {
  console.debug('Fetching', context.url.href);
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
    console.debug('Fetched', context.url.href);
    if(event.type === 'load') {
      const document = event.target.responseXML;
      const responseURL = new URL(event.target.responseURL);
      if(document) {
        const inPageIconURL = this.searchPageForFavicons(document, responseURL);
        if(inPageIconURL) {
          console.debug('Found icon url in page', inPageIconURL.href);
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
          console.debug('No icons in page', context.url.href);
          // Successful request but no icons found in page
          this.lookupPageResponseURL(context, new URL(responseURL));
        }
      } else {
        console.debug('Undefined document for', context.url.href);
        // Successful request but undefined document
        this.lookupPageResponseURL(context, new URL(responseURL));
      }
    } else {
      console.debug('Error fetching', context.url.href);
      // Unsuccesful request

      // Ensure this page is no longer in the cache
      // ???? Is this right?
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
    console.debug('Redirected, checking cache for', pageResponseURL.href);
    this.cache.findByPageURL(context.connection, pageResponseURL,
      onLookupResponseURL.bind(this));
  } else {
    this.lookupOrigin(context, pageResponseURL);
  }

  function onLookupResponseURL(event) {
    const result = event.target.result;
    if(event.type === 'success' && result && !this.isEntryExpired(result)) {
      console.debug('Found post redirect url in cache', pageResponseURL.href);
      context.connection.close();
      const iconURL = new URL(result.iconURLString);
      context.callback(iconURL);
    } else {
      console.debug('Did not find post redirect url in cache',
        pageResponseURL.href);
      this.lookupOrigin(context, pageResponseURL);
    }
  }
};

FaviconService.prototype.searchPageForFavicons = function(document, baseURL) {
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
      try {
        const iconURL = new URL(href, baseURL);
        return iconURL;
      } catch(exception) {
        console.debug(exception);
      }
    }
  }
};

FaviconService.prototype.lookupOrigin = function(context, pageResponseURL) {
  const originURL = new URL(context.url.origin);
  const originIconURL = new URL(context.url.origin + '/favicon.ico');

  if(this.cache && context.connection) {

    if(originURL.href === context.url.href) {
      console.debug('Origin same as known url, not checking cache',
        originURL.href);
      this.sendImageHeadRequest(originIconURL,
        this.onRequestOrigin.bind(this, context, pageResponseURL));
    } else if(pageResponseURL && pageResponseURL.href === originURL.href) {
      console.debug('Origin same as known url, not checking cache',
        originURL.href);
      this.sendImageHeadRequest(originIconURL,
        this.onRequestOrigin.bind(this, context, pageResponseURL));
    } else {
      console.debug('Searching cache for origin', originURL.href);
      this.cache.findByPageURL(context.connection, originURL,
        onLookupOrigin.bind(this));
    }
  } else {
    this.sendImageHeadRequest(originIconURL,
      this.onRequestOrigin.bind(this, context, pageResponseURL));
  }

  function onLookupOrigin(event) {
    const result = event.target.result;
    if(event.type === 'success' && result && !this.isEntryExpired(result)) {
      if(context.connection) {
        context.connection.close();
      }
      callback(originIconURL);
    } else {
      this.sendImageHeadRequest(originIconURL,
        this.onRequestOrigin.bind(this, context, pageResponseURL));
    }
  }
};

FaviconService.prototype.sendImageHeadRequest = function(imageURL, callback) {
  console.debug('Sending image head request for', imageURL.href);
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
  console.debug('Fetched', context.url.origin + '/favicon.ico');
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
    if(this.cache && context.connection) {
      this.cache.deleteByPageURL(context.connection, context.url);
      if(pageResponseURL && pageResponseURL.href !== context.url.href) {
        this.cache.deleteByPageURL(context.connection, pageResponseURL);
      }

      const originURL = new URL(context.url.origin);
      this.cache.deleteByPageURL(context.connection, originURL);

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
    console.debug(exception);
  }
};

FaviconService.prototype.isMimeTypeImage = function(mimeTypeString) {
  return /^\s*image\//i.test(mimeTypeString);
};
