// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Thirty days in milliseconds
const DEFAULT_EXPIRATION = 1000 * 60 * 60 * 24 * 30;

// Finds the url of the favicon associated with the given document url
// @param url {URL} - document url to lookup
// @param document {Document} - optional prefetched document, should be set if
// available because it potentially avoids network
// @param callback {function} - callback function passed the favicon url
// (type URL, not string).
function lookupFavicon(url, document, callback) {
  console.assert(url);
  console.assert(url.href);
  console.assert(callback);

  const context = {
    'url': url,
    'expires': DEFAULT_EXPIRATION,
    'callback': callback,
    'document': document,
    'db': null,
    'entry': null,
    'timeout': null
  };

  faviconConnect(connectOnsuccess.bind(context), connectOnerror.bind(context));
}

function connectOnsuccess(event) {
  this.db = event.target.result;

  // Upon connecting to the database, search the document. If an icon is found,
  // then update the cache entry for the url and callback. Do not try and update
  // the origin icon url because it could be different. If a document was not
  // provided or we cannot find the icon in the document, then fall back to
  // searching the cache for the request url as normal.
  if(this.document) {
    const iconURL = searchDocument(this.document, this.url);
    if(iconURL) {
      faviconAddEntry(this.db, this.url, iconURL);
      lookupFaviconOnComplete.call(this, iconURL);
      return;
    }
  }

  faviconFindEntry(this.db, this.url, onFindRequestURL.bind(this));
}

function connectOnerror(event) {
  console.error(event.target.error);

  // If we cannot connect to the database, fallback to checking if a document
  // was provided and search the document. If we found an icon then update the
  // iconURL variable. Otherwise leave it undefined. Then callback.
  let iconURL;
  if(this.document) {
    iconURL = searchDocument(this.document, this.url);
  }

  lookupFaviconOnComplete.call(this, iconURL);
}

function onFindRequestURL(entry) {
  this.entry = entry;

  // If we didn't find a cache entry, then fallback to fetching the content
  // of the url
  if(!entry) {
    console.debug('MISS', this.url.href);
    fetchHTML.call(this);
    return;
  }

  // If we did find an entry, but it is expired, then fallback to fetching the
  // content of the url.
  if(isEntryExpired(entry, this.expires)) {
    console.debug('Favicon entry expired', this.url.href);
    fetchHTML.call(this);
    return;
  }

  // We found an non-expired entry. Callback.
  const iconURL = new URL(entry.iconURLString);
  lookupFaviconOnComplete.call(this, iconURL);
}

// Returns true if the entry is older than or equal to the expiration period.
function isEntryExpired(entry, expires) {
  console.assert(entry);
  // Subtracting two dates yields the difference in ms
  const age = new Date() - entry.dateUpdated;
  return age >= expires;
}

function fetchHTML() {
  // If offline, and there was a cache hit, then fallback to using the expired
  // entry. If offline and no cache hit, then we are done.
  if('onLine' in navigator && !navigator.onLine) {
    let iconURL;
    if(this.entry) {
      iconURL = new URL(this.entry.iconURLString);
    }
    lookupFaviconOnComplete.call(this, iconURL);
    return;
  }

  // Proceed with sending a request for the document.
  console.debug('GET', this.url.href);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = fetchHTMLOnerror.bind(this);
  request.ontimeout = fetchHTMLOntimeout.bind(this);
  request.onabort = fetchHTMLOnabort.bind(this);
  request.onload = fetchHTMLOnsuccess.bind(this);
  request.open('GET', this.url.href, isAsync);
  // Attempt to limit the validity of the response
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function fetchHTMLOnabort(event) {
  console.debug(event.type, this.url.href);

  // If the fetch was aborted for some reason, then assume we shouldn't take
  // any additional action. Exit immediately without an icon url.
  lookupFaviconOnComplete.call(this);
}

function fetchHTMLOnerror(event) {
  console.debug(event.type, this.url.href);

  // If entry is defined, then that means we found a cache hit earlier, but
  // decided to fetch because the entry was expired. Because we then encountered
  // an error fetching, consider the url to be no longer valid, so delete the
  // entry from the cache. If the url is looked up again, then it will skip the
  // cache lookup and go straight to the fetch and possibly recreate itself.
  if(this.entry) {
    faviconDeleteEntry(this.db, this.url);
  }

  // Fallback to looking up the origin. Cannot use response url.
  lookupOriginURL.call(this);
}

function fetchHTMLOntimeout(event) {
  console.debug(event.type, this.url.href);
  // If we timed out trying to fetch the url, then fallback to checking the
  // origin. We cannot use the redirect url in this case because it is unknown.
  // Unlike onerror, this does not delete the entry, because a timeout may be
  // temporary. However, it may end up associating the request url with the
  // origin icon url, overwriting the entry for the request url that may have
  // existed prior to the lookup.
  lookupOriginURL.call(this);
}

function fetchHTMLOnsuccess(event) {
  console.assert(event.type === 'load');

  // If the fetch was successful then the redirect url will be defined and
  // will be valid. If no redirect occurred, then it will be equal to the
  // request url.
  const responseURL = new URL(event.target.responseURL);

  const document = event.target.responseXML;

  // If we successfully fetched the document but the response did not provide
  // a document, then consider the fetch a failure. Fallback to looking for the
  // redirect url in the cache. This is different from the other fetch errors
  // because this time the redirect url is available.
  if(!document) {
    lookupRedirectURL.call(this, responseURL);
    return;
  }

  // We successfully fetched a document. Search the page for favicons. Use the
  // response url as the base url to ensure we use the proper url in the event
  // of a redirect
  const iconURL = searchDocument(document, responseURL);
  if(iconURL) {
    console.debug('Found icon in page', this.url.href, iconURL.href);

    // Cache an entry for the request url
    faviconAddEntry(this.db, this.url, iconURL);

    // Cache an entry for the redirect url if it is different than the request
    // url
    if(responseURL.href !== this.url.href) {
      faviconAddEntry(this.db, responseURL, iconURL);
    }

    // An origin entry may exist, but leave it alone. The origin is the fallback
    // to the in-page icon, because each page in a domain can have its own
    // custom favicon.

    lookupFaviconOnComplete.call(this, iconURL);
  } else {
    console.debug('No icons found in page', this.url.href);
    // We successfully fetched the document for the request url, but did not
    // find any icons in its content. Fallback to looking for the redirect url
    // in the cache.
    lookupRedirectURL.call(this, responseURL);
  }
}

function lookupRedirectURL(redirectURL) {
  // If the redirect url differs from the request url, then search the
  // cache for the redirect url. Otherwise, fallback to searching the cache
  // for the origin.
  if(redirectURL && redirectURL.href !== this.url.href) {
    const onLookup = onLookupRedirectURL.bind(this, redirectURL);
    faviconFindEntry(this.db, redirectURL, onLookup);
  } else {
    lookupOriginURL.call(this, redirectURL);
  }
}

function onLookupRedirectURL(redirectURL, entry) {
  if(entry && !isEntryExpired(entry, this.expires)) {
    console.debug('Found non-expired redirect entry in cache', entry);
    // We only reached here if the lookup for the request url failed,
    // so add the request url to the cache as well, using the redirect url
    // icon. The lookup failed because the request url entry expired or because
    // it didn't exist or possibly because there was no icon found in the page.
    // If the entry expired it will be replaced here.
    const iconURL = new URL(entry.iconURLString);
    faviconAddEntry(this.db, this.url, iconURL);

    // We don't need to re-add the redirect url here. We are done.
    // We don't modify the origin entry if it exists here, because per-page
    // icons take priority over the default domain-wide root icon.
    lookupFaviconOnComplete.call(this, iconURL);
  } else {
    // If we failed to find the redirect url in the cache, then fallback to
    // looking for the origin.
    console.debug('Did not find redirect url', redirectURL.href);
    lookupOriginURL.call(this, redirectURL);
  }
}

function lookupOriginURL(redirectURL) {
  const originURL = new URL(this.url.origin);
  const originIconURL = new URL(this.url.origin + '/favicon.ico');

  // If the origin url is distinct from the request and response urls, then
  // lookup the origin in the cache. Otherwise, fallback to fetching the
  // the favicon url in the domain root.
  if(isOriginDiff(this.url, redirectURL, originURL)) {
    faviconFindEntry(this.db, originURL,
      onLookupOriginURL.bind(this, redirectURL));
  } else {
    sendImageHeadRequest(originIconURL,
      onFetchOrigin.bind(this, redirectURL));
  }
}

function onLookupOriginURL(redirectURL, entry) {
  if(entry && !isEntryExpired(entry, this.expires)) {
    // Associate the origin's icon with the request url if it differs
    const iconURL = new URL(entry.iconURLString);
    if(this.url.href !== this.url.origin) {
      faviconAddEntry(this.db, this.url, iconURL);
    }

    // Associate the origin's icon with the redirect url if it differs
    if(this.url.origin !== redirectURL.href) {
      faviconAddEntry(this.db, redirectURL, iconURL);
    }

    lookupFaviconOnComplete.call(this, iconURL);
  } else {
    // Fallback to searching the domain root
    const originIconURL = new URL(this.url.origin + '/favicon.ico');
    sendImageHeadRequest(originIconURL, onFetchOrigin.bind(this, redirectURL));
  }
}

// redirectURL is the redirect url of the request url given to lookupFavicon,
// it is not to be confused with the possible redirect that occured from the
// head request for the image.
function onFetchOrigin(redirectURL, iconURLString) {
  const originURL = new URL(this.url.origin);

  if(iconURLString) {
    // If sending a head request yielded a response, associate the urls with the
    // icon in the cache and callback.
    const iconURL = new URL(iconURLString);
    faviconAddEntry(this.db, this.url, iconURL);
    if(redirectURL && redirectURL.href !== this.url.href) {
      faviconAddEntry(this.db, redirectURL, iconURL);
    }
    if(isOriginDiff(this.url, redirectURL, originURL)) {
      faviconAddEntry(this.db, originURL, iconURL);
    }

    lookupFaviconOnComplete.call(this, iconURL);
  } else {
    // We failed to find anything. Ensure there is nothing in the cache.
    faviconDeleteEntry(this.db, this.url);
    if(redirectURL && redirectURL.href !== this.url.href) {
      faviconDeleteEntry(this.db, redirectURL);
    }

    if(isOriginDiff(this.url, redirectURL, originURL)) {
      faviconDeleteEntry(this.db, originURL);
    }

    lookupFaviconOnComplete.call(this);
  }
}

function lookupFaviconOnComplete(iconURLObject) {
  if(this.db) {
    this.db.close();
  }

  this.callback(iconURLObject);
}

const SELECTORS = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

function searchDocument(doc, baseURLObject) {
  console.assert(doc);
  if(doc.documentElement.localName !== 'html' || !doc.head) {
    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?
  for(let selector of SELECTORS) {
    const iconURL = match_selector(doc, selector, baseURLObject);
    if(iconURL) {
      return iconURL;
    }
  }
}

// Look for a specific favicon in the contents of a document
// In addition to being idiomatic, this localizes the try/catch scope so as
// to avoid a larger deopt.
function match_selector(ancestor, selector, baseURLObject) {
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
}

// Note that redirectURL may be undefined
function isOriginDiff(pageURL, redirectURL, originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
}

function sendImageHeadRequest(imgURLObject, callback) {
  console.debug('HEAD', imgURLObject.href);
  const request = new XMLHttpRequest();
  const isAsync = true;
  const onResponse = onRequestImageHead.bind(request, imgURLObject,
    callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imgURLObject.href, isAsync);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
}

function onRequestImageHead(imgURLObject, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const contentLength = getContentLength(response);
  if(!isContentLengthInRange(contentLength)) {
    callback();
    return;
  }

  const contentType = response.getResponseHeader('Content-Type');
  if(!isImageMimeType(contentType)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
}

const MIN_CONTENT_LEN = 49;
const MAX_CONTENT_LEN = 10001;

function isContentLengthInRange(lenInt) {
  return lenInt > MIN_CONTENT_LEN && lenInt < MAX_CONTENT_LEN;
}

function getContentLength(response) {
  const lenString = response.getResponseHeader('Content-Length');
  let lenInt = 0;
  if(lenString) {
    try {
      lenInt = parseInt(lenString, 10);
    } catch(error) {
    }
  }

  return lenInt;
}

function isImageMimeType(type) {
  return type && /^\s*image\//i.test(type);
}

this.lookupFavicon = lookupFavicon;
this.isFaviconEntryExpired = isEntryExpired;

} // End file block scope
