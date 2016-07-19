// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: under heavy development, not stable

// Creates a new instance of the service. Set the cache before calling lookup
// to cache requests and avoid network overhead and minimize presence.
function FaviconService() {
  // The fetch timeout, in milliseconds, optional
  this.timeout = null;
  // The associated cache, optional
  this.cache = null;

  // The minimum number of bytes of a valid favicon image
  this.minLength = 50;

  // The maximum number of bytes of a valid favicon image
  this.maxLength = 10000;

  // The number of milliseconds before a favicon expires, after which any
  // associated cache entries will be revalidated.
  this.expiresAfterMillis = 1000 * 60 * 60 * 24 * 30;
}

// Looks up the icon url associated with the given page url
// @param url {URL} a page url
// @param forceReload {boolean} if true, the url is checked despite even if the
// url is in the cache
// @param callback {function} called when the lookup completes, passes the
// corresponding url of the favicon as a URL object, or undefined if no
// associated favicon was found.
FaviconService.prototype.lookup = function(url, forceReload, callback) {

  // Create a shared state variable to simplify parameter passing across the
  // ensuing continuations for performing a lookup.
  const context = {
    'url': url,
    'forceReload': forceReload,
    'callback': callback,
    'connection': null,
    'entry': null,
    'responseURL': null
  };

  // If a cache is assigned, then open a cache connection in order to check if
  // the url is cached. Otherwise, fallback to looking for the icon in the
  // page contents.
  if(this.cache) {
    this.cache.connect(this._lookupOnConnect.bind(this, context));
  } else {
    this.fetchDocument(context);
  }
};

// Private helper function for lookup.
// If we successfully connected to the cache, look for the icon in the cache.
// Otherwise, fallback to looking for the icon in the page contents.
FaviconService.prototype._lookupOnConnect = function(context, event) {
  if(event.type === 'success') {
    console.debug('Connected to', this.cache.name);
    context.connection = event.target.connection;

    this.cache.findByPageURL(context.connection, context.url,
      this._onFindByURL.bind(this, context));
  } else {
    console.debug('Cache connection error:', event);
    this.fetchDocument(context);
  }
};

// Private helper function for lookup that is called as a result of querying
// the cache.
FaviconService.prototype._onFindByURL = function(context, event) {
  // If there was a problem querying the cache, fallback to looking for the
  // icon in the contents of the page.
  if(event.type !== 'success') {
    console.debug('Cache query error', event);
    this.fetchDocument(context);
    return;
  }

  // If there was no error, access the cache result, which may be undefined.
  // Attach the entry to the context so that later continuations can access it.
  context.entry = event.target.result;

  // If we did not find an entry in the cache, fallback to looking for the
  // icon in the page contents.
  if(!context.entry) {
    console.debug('Cache miss', context.url.href);
    this.fetchDocument(context);
    return;
  }

  // If entry was defined, we found a cache hit.
  console.debug('Cache hit', context.url.href, context.entry.iconURLString);

  // If forcing a reload, then look for the icon in the page contents. The
  // entry is attached to the context so that we can later decide how to deal
  // with it.
  if(context.forceReload) {
    console.debug('Forcing reload of entry', context.entry);
    this.fetchDocument(context);
    return;
  }

  // If not forcing a reload then check if the entry expired. If it expired,
  // look for the icon in the page contents. If not expired, callback with the
  // cached icon url.
  const dateNow = new Date();
  const entryAgeInMillis = dateNow.getTime() - entry.dateUpdated.getTime();
  if(entryAgeInMillis > this.expiresAfterMillis) {
    console.debug('Cache entry expired', entry);
    this.fetchDocument(context);
  } else {
    context.connection.close();
    const iconURL = new URL(context.entry.iconURLString);
    context.callback(iconURL);
  }
};

// Private helper for lookup
FaviconService.prototype.fetchDocument = function(context) {
  console.debug('GET', context.url.href);

  // In order to assist with disambiguating whether the icon is temporarily
  // unreachable or does not exist, check if we are online.
  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Fetch error: offline');

    // If a cache was assigned and a connection was available, then close
    // the cache connection.
    if(this.cache && context.connection) {
      context.connection.close();
    }

    if(context.entry) {
      // We are offline, but we had a cache hit, so fallback to
      // calling back with the last known entry
      const iconURL = new URL(context.entry.iconURLString);
      context.callback(iconURL);
    } else {
      // We are offline, and had a cache miss
      context.callback();
    }

    return;
  }

  // Send a GET request for an HTML page.
  const onFetch = this._onFetchDocument.bind(this, context);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = onFetch;
  request.ontimeout = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('GET', context.url.href, isAsync);
  // Attempt to cause an error if the response is not an allowed mime type.
  // I am not sure if this is doing anything.
  // request.setRequestHeader must be called after request.open
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

FaviconService.prototype._onFetchDocument = function(context, event) {
  // If a fetch error occurred, then fallback to looking in the domain root.
  // We cannot check for a redirect here because event.target.responseURL will
  // be undefined.

  // TODO: if we are doing a forceReload and the page was in the cache and
  // there was a problem fetching the page, then I think maybe I should be
  // deleting the entry? Or maybe something like incrementing its failure count
  // if if the failure count is > 3 or something like that, removing it.

  if(event.type !== 'load') {
    console.debug('Fetch error', event.type, context.url.href);
    this._lookupOrigin(context);
    return;
  }

  // Get the responseURL. This can help detect if a redirect occurred. The
  // responseURL is always defined if the response loaded successfully.
  const responseURL = new URL(event.target.responseURL);

  // Get the response document
  const document = event.target.responseXML;
  // The document may be undefined when there was a successful request but
  // the mime type was incorrect or a parsing error occured. Fallback to
  // looking in the domain root.
  if(!document) {
    console.debug('Undefined document error', context.url.href);

    // If a redirect occurred and a cache is available and we connected to the
    // cache, then check if the redirected url is cached before falling back
    // to looking for the domain root. Otherwise, fallback to looking for the
    // icon in the domain root.
    if(!context.forceReload && this.cache && context.connection &&
      responseURL.href !== context.url.href) {
      this._findCachedRedirectURL(context, responseURL);
    } else {
      this._lookupOrigin(context);
    }

    return;
  }

  // Search the document contents for a favicon url. Use the responseURL as
  // the base url for url resolution.
  const linkURL = this.searchPageForFavicons(document, responseURL);

  // If we did not find an icon in the page, fallback to checking whether a
  // redirect ocurred. If a cache is available and we are connected to the
  // cache and a redirect occurred, then check if the redirect is cached.
  // Otherwise, fallback to looking in the domain root.
  if(!linkURL) {
    console.debug('Did not find in page icon url for', context.url.href);
    if(!context.forceReload && this.cache && context.connection &&
      responseURL.href !== context.url.href) {
      this._findCachedRedirectURL(context, responseURL);
    } else {
      this._lookupOrigin(context);
    }

    return;
  }


  // TODO: if one of the urls is found, is it worth sending out another request
  // to verify the url is reachable?

  console.debug('Found in page url:', linkURL.href);

  // TODO: this may occur after a cache hit with forceReload on, or an expired
  // entry, meaning that
  // the add will fail. So instead the add should be a put or an update or
  // something to that effect. Really all we are doing I think is changing
  // the entry by further delaying the expiration date. If I am just storing
  // the fetch/created/updated/whatever date property, then all I am doing
  // is changing that to the current client time. The current time plus the
  // cache time is what yields the expiration date. So I all really need to
  // do is change this time to the current time.

  // I think the way to solve this is to create a new function, cache
  // .updateEntry that takes the connection and entry and uses put

  if(this.cache && context.connection) {
    this.cache.addEntry(context.connection, context.url, linkURL);

    // If there was a redirect, then I also want to store or update the
    // redirect pairing with the same icon.
    if(responseURL.href !== context.url.href) {
      this.cache.addEntry(context.connection, responseURL, linkURL);
    }

    context.connection.close();
  }

  context.callback(linkURL);



};

FaviconService.prototype.searchPageForFavicons = function(document, baseURL) {
  const selectors = [
    'head > link[rel="icon"][href]',
    'head > link[rel="shortcut icon"][href]',
    'head > link[rel="apple-touch-icon"][href]',
    'head > link[rel="apple-touch-icon-precomposed"][href]'
  ];

  let linkURL = null;
  for(let i = 0, len = selectors.length; !linkURL && i < len; i++) {
    linkURL = this.findURLInPage(document, selectors[i], baseURL);
  }

  return linkURL;
};

// Searches for the favicon url in the contents of an HTML document, and if
// found and appears valid (no parsing errors), returns the absolute form of
// the url.
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

FaviconService.prototype._findCachedRedirectURL = function(context,
  responseURL) {

  if(context.forceReload) {
    this._lookupOrigin(context);
    return;
  }

  if(!this.cache) {
    this._lookupOrigin(context);
    return;
  }

  if(!context.connection) {
    this._lookupOrigin(context);
    return;
  }

  this.cache.findByPageURL(context.connection, responseURL,
    this._onFindCachedRedirectURL.bind(this, context, responseURL));
};

FaviconService.prototype._onFindCachedRedirectURL = function(context,
  responseURL, event) {
  if(event.type === 'success' && event.target.result) {
    // TODO: should i be doing something like updating the original url in the
    // cache so it avoids this lookup next time? like assigning the icon of
    // the redirect url to the original url?
    context.connection.close();
    const iconURL = new URL(event.target.result.iconURLString);
    context.callback(iconURL);
  } else {
    this._lookupOrigin(context);
  }
};


FaviconService.prototype._lookupOrigin(context) {
  const originURL = new URL(context.url.origin);
  const originIconURL = new URL(context.url.origin + '/favicon.ico');

  // If a cache is available and we are connected to the cache, then look for
  // the origin in the cache.

  if(this.cache && context.connection) {
    this.cache.findByPageURL(context.connection, originURL,
      this._onFindByOriginURL.bind(this, context));
  } else {
    this.sendImageHeadRequest(originIconURL,
      this.onRequestOriginIcon.bind(this, context));
  }
};

FaviconService.prototype._onFindByOriginURL = function(context, event) {

  const originIconURL = new URL(context.url.origin + '/favicon.ico');

  if(event.type !== 'success') {
    this.sendImageHeadRequest(originIconURL,
      this.onRequestOriginIcon.bind(this, context));
    return;
  }

  const entry = event.target.result;

  if(!entry) {
    this.sendImageHeadRequest(originIconURL,
      this.onRequestOriginIcon.bind(this, context));
    return;
  }

  // Found the origin in the cache

  if(this.cache && context.connection) {
    connection.close();
  }

  context.callback(originIconURL);
};

FaviconService.prototype.sendImageHeadRequest = function(imageURL, callback) {
  console.debug('HEAD', imageURL.href);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.ontimeout = callback;
  request.onerror = callback;
  request.onabort = callback;
  request.onload = callback;
  request.open('HEAD', imageURL.href, isAsync);
  // Must call after open
  request.setRequestHeader('Accept', 'image/*');
  request.send();
};

FaviconService.prototype.onRequestOriginIcon = function(context, event) {

  if(event.type !== 'load') {
    console.debug('HEAD response error', event);

    if(context.entry && context.forceReload && this.cache &&
      context.connection) {
      const pageURL = new URL(context.entry.pageURLString);
      this.cache.deleteByPageURL(pageURL);
      const originURL = new URL(pageURL.origin);
      this.cache.deleteByPageURL(originURL);
    }

    if(this.cache && context.connection) {
      context.connection.close();
    }

    context.callback();
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

    // If there was a redirect when requesting the page HTML then we also
    // want to store a pairing for that.
    if(context.responseURL && context.responseURL.href !== context.url.href) {
      this.cache.addEntry(context.connection, context.responseURL, iconURL);
    }

    context.connection.close();
  }

  context.callback(iconURL);
};
