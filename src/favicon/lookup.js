// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.favicon = rdr.favicon || {};

// Finds the favicon associated with the given url
// @param url {URL} document url to lookup
// @param document {Document} optional prefetched document, should be set if
// available because it potentially avoids network
// @param callback {function} callback function passed the favicon url
// (type URL).
// TODO: maybe accept something like a FaviconQuery object instance as input,
// to abstract the parameters and simplify calling this
rdr.favicon.lookup = function(url, doc, verbose, callback) {
  if(!rdr.utils.isURLObject(url)) {
    throw new TypeError('invalid url parameter: ' + url);
  }

  if(!callback) {
    throw new TypeError('callback must be a function');
  }

  const context = {
    'url': url,
    'expires': rdr.favicon.cache.expires,
    'callback': callback,
    'doc': doc,
    'db': null,
    'entry': null,
    'timeout': null,
    'verbose': verbose
  };

  if(verbose) {
    console.debug('lookup', url.href);
  }

  rdr.favicon.cache.connect(rdr.favicon._connectOnSuccess.bind(context),
    rdr.favicon._connectOnError.bind(context));
};

// Upon connecting to the database, search the document. If an icon is found,
// then update the cache entry for the url and callback. Do not try and update
// the origin icon url because it could be different. If a document was not
// provided or we cannot find the icon in the document, then fall back to
// searching the cache for the request url as normal.
rdr.favicon._connectOnSuccess = function(event) {

  if(this.verbose) {
    console.debug('Connected to favicon cache');
  }

  this.db = event.target.result;
  if(this.doc) {
    const iconURL = rdr.favicon.searchDocument(this.doc, this.url);
    if(iconURL) {

      if(this.verbose) {
        console.debug('Found icon in prefetched document', iconURL.href);
      }

      rdr.favicon.cache.add(this.db, this.url, iconURL);
      rdr.favicon._onLookupComplete.call(this, iconURL);
      return;
    }
  }

  if(this.verbose) {
    console.debug('Checking cache for', this.url.href);
  }

  rdr.favicon.cache.find(this.db, this.url,
    rdr.favicon._onFindRequestURL.bind(this));
};

// If we cannot connect to the database, fallback to checking if a document
// was provided and search the document. If we found an icon then callback with
// with the icon. Otherwise callback without an icon. In either case we cannot
// touch the cache.
rdr.favicon._connectOnError = function(event) {
  console.error(event.target.error);
  let iconURL;
  if(this.doc) {
    iconURL = rdr.favicon.searchDocument(this.doc, this.url);
  }

  rdr.favicon._onLookupComplete.call(this, iconURL);
};

rdr.favicon._onFindRequestURL = function(entry) {
  this.entry = entry;

  // If we didn't find a cache entry, then fallback to fetching the content
  // of the url
  if(!entry) {

    if(this.verbose) {
      console.debug('No entry found in cache with page url', this.url.href);
    }

    rdr.favicon._fetchDocument.call(this);
    return;
  }

  // If we did find an entry, but it is expired, then fallback to fetching the
  // content of the url.
  if(rdr.favicon.cache.isExpired(entry, this.expires)) {

    if(this.verbose) {
      console.debug('Found expired entry in cache with url', this.url.href);
    }

    rdr.favicon._fetchDocument.call(this);
    return;
  }

  if(this.verbose) {
    console.debug('Found non-expired entry', this.url.href,
      entry.iconURLString);
  }

  // We found an non-expired entry. Callback with the icon url.
  const iconURL = new URL(entry.iconURLString);
  rdr.favicon._onLookupComplete.call(this, iconURL);
};

rdr.favicon._fetchDocument = function() {
  // If offline, and there was a cache hit, then fallback to using the expired
  // entry. If offline and no cache hit, then we are done.
  if('onLine' in navigator && !navigator.onLine) {

    if(this.verbose) {
      console.debug('Detected offline state');
    }

    let iconURL;
    if(this.entry) {
      iconURL = new URL(this.entry.iconURLString);
    }
    rdr.favicon._onLookupComplete.call(this, iconURL);
    return;
  }



  // If we cannot detect connectivity state or know we are online, then fetch
  // the html document at the url.
  if(this.verbose) {
    console.debug('GET', this.url.href);
  }

  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = rdr.favicon._fetchDocumentOnError.bind(this);
  request.ontimeout = rdr.favicon._fetchDocumentOnTimeout.bind(this);
  request.onabort = rdr.favicon._fetchDocumentOnAbort.bind(this);
  request.onload = rdr.favicon._fetchDocumentOnSuccess.bind(this);
  request.open('GET', this.url.href, isAsync);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

// If the fetch was aborted, then exit without an icon url. An aborted request
// does not mean that the url is unreachable so we cannot infer anything from
// this.
// TODO: maybe still call back with expired entry if available
rdr.favicon._fetchDocumentOnAbort = function(event) {
  if(this.verbose) {
    console.debug(event.type, this.url.href);
  }

  rdr.favicon._onLookupComplete.call(this);
};

// If entry is defined, then that means we found a cache hit earlier, but
// decided to fetch because the entry was expired. Because we then encountered
// an error fetching, consider the url invalid and remove the expired entry from
// the cache. If the url is looked up again, then it will fail the cache lookup
// instead of finding the expired entry again, and then skip to fetching.
rdr.favicon._fetchDocumentOnError = function(event) {
  if(this.verbose) {
    console.debug(event.type, this.url.href);
  }

  if(this.entry) {
    rdr.favicon.cache.remove(this.db, this.url);
  }
  rdr.favicon._lookupOriginURL.call(this);
};

// If we timed out trying to fetch the url, then fallback to checking the
// origin. We cannot use the redirect url in this case because it is unknown.
// Unlike onerror, this does not delete the entry, because a timeout may be
// temporary. However, it may end up associating the request url with the
// origin icon url, overwriting the entry for the request url that may have
// existed prior to the lookup.
rdr.favicon._fetchDocumentOnTimeout = function(event) {
  if(this.verbose) {
    console.debug(event.type, this.url.href);
  }

  rdr.favicon._lookupOriginURL.call(this);
};

rdr.favicon._fetchDocumentOnSuccess = function(event) {
  if(this.verbose) {
    console.debug('Fetched document at', this.url.href);
  }

  // If the fetch was successful then the redirect url will be defined and
  // will be valid. If no redirect occurred, then it will be equal to the
  // request url.
  const responseURL = new URL(event.target.responseURL);

  if(this.verbose) {
    if(responseURL.href !== this.url.href) {
      console.debug('Detected redirect', responseURL.href);
    }
  }

  // If we successfully fetched the document but the response did not provide
  // a document, then consider the fetch a failure. Fallback to looking for the
  // redirect url in the cache. This is different from the other fetch errors
  // because this time the redirect url is available.
  const doc = event.target.responseXML;
  if(!doc) {
    if(this.verbose) {
      console.debug('Undefined document', this.url.href);
    }

    rdr.favicon._lookupRedirectURL.call(this, responseURL);
    return;
  }

  // We successfully fetched a document. Search the page for favicons. Use the
  // response url as the base url to ensure we use the proper url in the event
  // of a redirect
  const iconURL = rdr.favicon.searchDocument(doc, responseURL);
  if(iconURL) {
    if(this.verbose) {
      console.debug('Found icon in page', this.url.href, iconURL.href);
    }

    rdr.favicon.cache.add(this.db, this.url, iconURL);
    if(responseURL.href !== this.url.href) {
      rdr.favicon.cache.add(this.db, responseURL, iconURL);
    }

    rdr.favicon._onLookupComplete.call(this, iconURL);
  } else {
    if(this.verbose) {
      console.debug('No icon found in fetched document', this.url.href);
    }

    // We successfully fetched the document for the request url, but did not
    // find any icons in its content. Fallback to looking for the redirect url
    // in the cache.
    rdr.favicon._lookupRedirectURL.call(this, responseURL);
  }
};

// If the redirect url differs from the request url, then search the
// cache for the redirect url. Otherwise, fallback to searching the cache
// for the origin.
rdr.favicon._lookupRedirectURL = function(redirectURL) {
  if(redirectURL && redirectURL.href !== this.url.href) {

    if(this.verbose) {
      console.debug('Searching cache for redirect url', redirectURL.href);
    }

    const onLookup = rdr.favicon._onLookupRedirectURL.bind(this, redirectURL);
    rdr.favicon.cache.find(this.db, redirectURL, onLookup);
  } else {
    rdr.favicon._lookupOriginURL.call(this, redirectURL);
  }
};

rdr.favicon._onLookupRedirectURL = function(redirectURL, entry) {
  if(entry && !rdr.favicon.cache.isExpired(entry, this.expires)) {

    if(this.verbose) {
      console.debug('Found non expired redirect url entry in cache',
        redirectURL.href);
    }

    // We only reached here if the lookup for the request url failed,
    // so add the request url to the cache as well, using the redirect url
    // icon. The lookup failed because the request url entry expired or because
    // it didn't exist or possibly because there was no icon found in the page.
    // If the entry expired it will be replaced here.
    const iconURL = new URL(entry.iconURLString);
    rdr.favicon.cache.add(this.db, this.url, iconURL);

    // We don't need to re-add the redirect url here. We are done.
    // We don't modify the origin entry if it exists here, because per-page
    // icons take priority over the default domain-wide root icon.
    rdr.favicon._onLookupComplete.call(this, iconURL);
  } else {
    // If we failed to find the redirect url in the cache, then fallback to
    // looking for the origin.
    // console.debug('Did not find redirect url', redirectURL.href);
    rdr.favicon._lookupOriginURL.call(this, redirectURL);
  }
};

// If the origin url is distinct from the request and response urls, then
// lookup the origin in the cache. Otherwise, fallback to fetching the
// the favicon url in the domain root.
rdr.favicon._lookupOriginURL = function(redirectURL) {
  const originURL = new URL(this.url.origin);
  const originIconURL = new URL(this.url.origin + '/favicon.ico');
  if(rdr.favicon.isOriginDiff(this.url, redirectURL, originURL)) {

    if(this.verbose) {
      console.debug('Searching cache for origin url', originURL.href);
    }

    rdr.favicon.cache.find(this.db, originURL,
      rdr.favicon._onLookupOriginURL.bind(this, redirectURL));
  } else {
    rdr.favicon.sendImageHeadRequest(originIconURL,
      rdr.favicon._onFetchRootIcon.bind(this, redirectURL));
  }
};

rdr.favicon._onLookupOriginURL = function(redirectURL, entry) {
  if(entry && !rdr.favicon.cache.isExpired(entry, this.expires)) {

    if(this.verbose) {
      console.debug('Found non-expired origin entry in cache', originURL.href,
        entry.iconURLString);
    }

    const iconURL = new URL(entry.iconURLString);
    if(this.url.href !== this.url.origin) {
      rdr.favicon.cache.add(this.db, this.url, iconURL);
    }

    if(this.url.origin !== redirectURL.href) {
      rdr.favicon.cache.add(this.db, redirectURL, iconURL);
    }

    rdr.favicon._onLookupComplete.call(this, iconURL);
  } else {
    // Fallback to searching the domain root
    const originIconURL = new URL(this.url.origin + '/favicon.ico');
    rdr.favicon.sendImageHeadRequest(originIconURL,
      rdr.favicon._onFetchRootIcon.bind(this, redirectURL));
  }
};

// redirectURL is the redirect url of the request url which should not be
// confused with the possible redirect that occured from the head request for
// the image
rdr.favicon._onFetchRootIcon = function(redirectURL, iconURLString) {
  const originURL = new URL(this.url.origin);
  const cache = rdr.favicon.cache;

  if(iconURLString) {

    if(this.verbose) {
      console.debug('Found icon at domain root', iconURLString);
    }

    // If sending a head request yielded a valid icon, associate the urls with
    // the icon in the cache and callback.
    const iconURL = new URL(iconURLString);
    cache.add(this.db, this.url, iconURL);
    if(redirectURL && redirectURL.href !== this.url.href) {
      cache.add(this.db, redirectURL, iconURL);
    }
    if(rdr.favicon.isOriginDiff(this.url, redirectURL, originURL)) {
      cache.add(this.db, originURL, iconURL);
    }

    rdr.favicon._onLookupComplete.call(this, iconURL);
  } else {

    if(this.verbose) {
      console.debug('All attempts failed for', this.url.href);
    }

    // We failed to find anything. Ensure there is nothing in the cache.
    cache.remove(this.db, this.url);
    if(redirectURL && redirectURL.href !== this.url.href) {
      cache.remove(this.db, redirectURL);
    }

    if(rdr.favicon.isOriginDiff(this.url, redirectURL, originURL)) {
      cache.remove(this.db, originURL);
    }

    rdr.favicon._onLookupComplete.call(this);
  }
};

rdr.favicon._onLookupComplete = function(iconURLObject) {
  if(this.db) {

    if(this.verbose) {
      console.debug('Requesting favicon cache db to close');
    }

    this.db.close();
  }

  this.callback(iconURLObject);
};

rdr.favicon.iconSelectors = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

rdr.favicon.searchDocument = function(doc, baseURLObject) {
  if(doc.documentElement.localName !== 'html' || !doc.head) {

    if(this.verbose) {
      console.debug('Document is not html or missing <head>',
        doc.documentElement.outerHTML);
    }

    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?
  for(let selector of rdr.favicon.iconSelectors) {
    const iconURL = rdr.favicon.matchSelector(doc, selector, baseURLObject);
    if(iconURL) {
      return iconURL;
    }
  }
};

// Look for a specific favicon in the contents of a document
// In addition to being idiomatic, this localizes the try/catch scope so as
// to avoid a larger deopt.
rdr.favicon.matchSelector = function(ancestor, selector, baseURLObject) {
  const element = ancestor.querySelector(selector);
  if(!element) {
    return;
  }

  const href = (element.getAttribute('href') || '').trim();
  // If the first argument to the URL constructor is an empty string, then
  // the constructor creates a copy of the base url, which is not the desired
  // behavior, so guard against this.
  if(!href) {
    return;
  }

  try {
    return new URL(href, baseURLObject);
  } catch(error) {
    console.debug(error);
  }
};

// Note that redirectURL may be undefined
rdr.favicon.isOriginDiff = function(pageURL, redirectURL, originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
};

rdr.favicon.sendImageHeadRequest = function(imgURLObject, callback) {
  const request = new XMLHttpRequest();
  const isAsync = true;
  const onResponse = rdr.favicon._onRequestImageHead.bind(request, imgURLObject,
    callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imgURLObject.href, isAsync);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
};

rdr.favicon._onRequestImageHead = function(imgURLObject, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const size = rdr.favicon.getImageSize(response);
  if(!rdr.favicon.isImageFileSizeInRange(size)) {
    callback();
    return;
  }

  const type = response.getResponseHeader('Content-Type');
  if(type && !rdr.favicon.isImageMimeType(type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
};

rdr.favicon.minImageSize = 49;
rdr.favicon.maxImageSize = 10001;

rdr.favicon.isImageFileSizeInRange = function(size) {
  return size > rdr.favicon.minImageSize && size < rdr.favicon.maxImageSize;
};

rdr.favicon.getImageSize = function(response) {
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

rdr.favicon.isImageMimeType = function(type) {
  return /^\s*image\//i.test(type);
};
