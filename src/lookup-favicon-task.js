// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Provides primarily a lookup function to find the favicon for a url
function LookupFaviconTask() {
  this.cache = new FaviconCache();
  this.log = new LoggingService();
  this.timeout = null;
  this.maxAge = this.cache.defaultMaxAge;
}

// @param url {URL} the web page to find a favicon for
// @param doc {Document} optional, prefetched document
// @param callback {function} callback receives icon url or undefined
LookupFaviconTask.prototype.start = function(url, doc, callback) {
  this.log.log('LOOKUP', url.href);

  const ctx = {
    'url': url,
    'callback': callback,
    'doc': doc,
    'db': null,
    'entry': null
  };

  this.cache.connect(this._connectOnSuccess.bind(this, ctx),
    this._connectOnError.bind(this, ctx));
};

LookupFaviconTask.prototype._connectOnSuccess = function(ctx, event) {
  this.log.log('Connected to favicon cache');
  ctx.db = event.target.result;
  if(ctx.doc) {
    const iconURL = this.searchDocument(ctx.doc, ctx.url);
    if(iconURL) {
      this.log.log('Found icon in prefetched doc', iconURL.href);
      this.cache.add(ctx.db, ctx.url, iconURL);
      return this._onLookupComplete(ctx, iconURL);
    }
  }

  this.cache.find(ctx.db, ctx.url, this._onFindRequestURL.bind(this, ctx));
};

LookupFaviconTask.prototype._connectOnError = function(ctx, event) {
  this.log.error(event.target.error);
  let iconURL;
  if(ctx.doc) {
    iconURL = this.searchDocument(ctx.doc, ctx.url);
  }
  this._onLookupComplete(ctx, iconURL);
};

LookupFaviconTask.prototype._onFindRequestURL = function(ctx, entry) {
  if(!entry) {
    return this._fetchDocument(ctx);
  }

  ctx.entry = entry;
  if(this.cache.isExpired(entry, this.maxAge)) {
    this.log.log('HIT (expired)', ctx.url.href);
    return this._fetchDocument(ctx);
  }

  const iconURL = new URL(entry.iconURLString);
  this._onLookupComplete(ctx, iconURL);
};

LookupFaviconTask.prototype._fetchDocument = function(ctx) {
  if('onLine' in navigator && !navigator.onLine) {
    this.log.debug('Offline');
    let iconURL;
    if(ctx.entry) {
      iconURL = new URL(ctx.entry.iconURLString);
    }
    this._onLookupComplete(ctx, iconURL);
    return;
  }

  this.log.log('GET', ctx.url.href);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = this._fetchDocumentOnError.bind(this, ctx);
  request.ontimeout = this._fetchDocumentOnTimeout.bind(this, ctx);
  request.onabort = this._fetchDocumentOnAbort.bind(this, ctx);
  request.onload = this._fetchDocumentOnSuccess.bind(this, ctx);
  request.open('GET', ctx.url.href, isAsync);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

LookupFaviconTask.prototype._fetchDocumentOnAbort = function(ctx, event) {
  this.log.error(event.type, ctx.url.href);
  this._onLookupComplete(ctx);
};

LookupFaviconTask.prototype._fetchDocumentOnError = function(ctx, event) {
  this.log.error(event.type, ctx.url.href);
  if(ctx.entry) {
    this.cache.remove(ctx.db, ctx.url);
  }
  this._lookupOriginURL(ctx);
};

LookupFaviconTask.prototype._fetchDocumentOnTimeout = function(ctx, event) {
  this.log.debug(event.type, ctx.url.href);
  this._lookupOriginURL(ctx);
};

LookupFaviconTask.prototype._fetchDocumentOnSuccess = function(ctx, event) {
  this.log.debug('GOT', ctx.url.href);
  const responseURL = new URL(event.target.responseURL);
  if(responseURL.href !== ctx.url.href) {
    this.log.debug('REDIRECT', ctx.url.href, '>', responseURL.href);
  }

  const doc = event.target.responseXML;
  if(!doc) {
    this.log.debug('Undefined document', ctx.url.href);
    this._lookupRedirectURL(ctx, responseURL);
    return;
  }

  const iconURL = this.searchDocument(doc, responseURL);
  if(iconURL) {
    this.log.debug('Found icon in page', ctx.url.href, iconURL.href);
    this.cache.add(ctx.db, ctx.url, iconURL);
    if(responseURL.href !== ctx.url.href) {
      this.cache.add(ctx.db, responseURL, iconURL);
    }

    this._onLookupComplete(ctx, iconURL);
  } else {
    this.log.debug('No icon in fetched document', ctx.url.href);
    this._lookupRedirectURL(ctx, responseURL);
  }
};

LookupFaviconTask.prototype._lookupRedirectURL = function(ctx, redirectURL) {
  if(redirectURL && redirectURL.href !== ctx.url.href) {
    this.log.debug('Searching cache for redirect url', redirectURL.href);
    const onLookup = this._onLookupRedirectURL.bind(this, ctx, redirectURL);
    this.cache.find(ctx.db, redirectURL, onLookup);
  } else {
    this._lookupOriginURL(ctx, redirectURL);
  }
};

LookupFaviconTask.prototype._onLookupRedirectURL = function(ctx, redirectURL,
  entry) {
  if(entry && !this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Found non expired redirect url entry in cache',
      redirectURL.href);
    const iconURL = new URL(entry.iconURLString);
    this.cache.add(ctx.db, ctx.url, iconURL);
    this._onLookupComplete(ctx, iconURL);
  } else {
    this._lookupOriginURL(ctx, redirectURL);
  }
};

LookupFaviconTask.prototype._lookupOriginURL = function(ctx, redirectURL) {
  const originURL = new URL(ctx.url.origin);
  const originIconURL = new URL(ctx.url.origin + '/favicon.ico');
  if(this.isOriginDiff(ctx.url, redirectURL, originURL)) {
    this.log.debug('Searching cache for origin url', originURL.href);
    this.cache.find(ctx.db, originURL,
      this._onLookupOriginURL.bind(this, ctx, redirectURL));
  } else {
    this.sendImageHeadRequest(originIconURL,
      this._onFetchRootIcon.bind(this, ctx, redirectURL));
  }
};

LookupFaviconTask.prototype._onLookupOriginURL = function(ctx, redirectURL,
  entry) {
  if(entry && !this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Found non-expired origin entry in cache',
      entry.pageURLString, entry.iconURLString);
    const iconURL = new URL(entry.iconURLString);
    if(ctx.url.href !== ctx.url.origin) {
      this.cache.add(ctx.db, ctx.url, iconURL);
    }

    if(ctx.url.origin !== redirectURL.href) {
      this.cache.add(ctx.db, redirectURL, iconURL);
    }

    this._onLookupComplete(ctx, iconURL);
  } else {
    const originIconURL = new URL(ctx.url.origin + '/favicon.ico');
    this.sendImageHeadRequest(originIconURL,
      this._onFetchRootIcon.bind(this, ctx, redirectURL));
  }
};

LookupFaviconTask.prototype._onFetchRootIcon = function(ctx, redirectURL,
  iconURLString) {
  const originURL = new URL(ctx.url.origin);

  if(iconURLString) {
    this.log.debug('Found icon at domain root', iconURLString);
    const iconURL = new URL(iconURLString);
    this.cache.add(ctx.db, ctx.url, iconURL);
    if(redirectURL && redirectURL.href !== ctx.url.href) {
      this.cache.add(ctx.db, redirectURL, iconURL);
    }
    if(this.isOriginDiff(ctx.url, redirectURL, originURL)) {
      this.cache.add(ctx.db, originURL, iconURL);
    }
    this._onLookupComplete(ctx, iconURL);
  } else {
    this.log.debug('FULL-FAIL', ctx.url.href);
    this.cache.remove(ctx.db, ctx.url);
    if(redirectURL && redirectURL.href !== ctx.url.href) {
      this.cache.remove(ctx.db, redirectURL);
    }
    if(this.isOriginDiff(ctx.url, redirectURL, originURL)) {
      this.cache.remove(ctx.db, originURL);
    }
    this._onLookupComplete(ctx);
  }
};

LookupFaviconTask.prototype._onLookupComplete = function(ctx, iconURLObject) {
  if(ctx.db) {
    this.log.debug('Requesting database to close');
    ctx.db.close();
  }

  ctx.callback(iconURLObject);
};

LookupFaviconTask.prototype.iconSelectors = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

LookupFaviconTask.prototype.searchDocument = function(doc, baseURLObject) {
  if(doc.documentElement.localName !== 'html' || !doc.head) {
    this.log.debug('Document is not html or missing <head>',
        doc.documentElement.outerHTML);
    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?
  for(let selector of this.iconSelectors) {
    const iconURL = this.matchSelector(doc, selector, baseURLObject);
    if(iconURL) {
      return iconURL;
    }
  }
};

LookupFaviconTask.prototype.matchSelector = function(ancestor, selector, baseURL) {
  const element = ancestor.querySelector(selector);
  if(!element) {
    return;
  }
  const href = (element.getAttribute('href') || '').trim();
  if(!href) {
    return;
  }
  try {
    return new URL(href, baseURL);
  } catch(error) {
    console.debug(error);
  }
};

LookupFaviconTask.prototype.isOriginDiff = function(pageURL, redirectURL,
  originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
};

LookupFaviconTask.prototype.sendImageHeadRequest = function(imgURL, callback) {
  const request = new XMLHttpRequest();
  const isAsync = true;
  const onResponse = this._onRequestImageHead.bind(this, imgURL, callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imgURL.href, isAsync);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
};

LookupFaviconTask.prototype._onRequestImageHead = function(imgURL, callback,
  event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const size = this.getImageSize(response);
  if(!this.isImageFileSizeInRange(size)) {
    callback();
    return;
  }

  const type = response.getResponseHeader('Content-Type');
  if(type && !this.isImageMimeType(type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
};

LookupFaviconTask.prototype.minImageSize = 49;
LookupFaviconTask.prototype.maxImageSize = 10001;

LookupFaviconTask.prototype.isImageFileSizeInRange = function(size) {
  return size > this.minImageSize && size < this.maxImageSize;
};

LookupFaviconTask.prototype.getImageSize = function(response) {
  const lenString = response.getResponseHeader('Content-Length');
  let lenInt = 0;
  if(lenString) {
    try {
      lenInt = parseInt(lenString, 10);
    } catch(error) {
      console.debug(error);
    }
  }

  return lenInt;
};

LookupFaviconTask.prototype.isImageMimeType = function(type) {
  return /^\s*image\//i.test(type);
};
