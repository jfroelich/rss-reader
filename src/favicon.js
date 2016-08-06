// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const favicon = {};


favicon.lookup = function(url, document, callback) {
  console.assert(url && 'href' in url, 'url must be a defined url object');
  // console.debug('Looking up favicon for page', url.href);

  // Create a variable for simpler sharing of information across continuations
  const context = {
    'url': url,
    'databaseName': 'favicon-cache',
    'databaseVersion': 1,
    'expiresAfterMillis': 1000 * 60 * 60 * 24 * 30,
    'callback': callback,
    'document': document,
    'connection': null,
    'entry': null,
    'timeout': null
  };

  // Connect to the cache
  const name = 'favicon-cache';
  const version = 1;
  const request = indexedDB.open(context.databaseName, context.databaseVersion);
  request.onupgradeneeded = favicon.onUpgradeNeeded.bind(request, context);
  request.onsuccess = favicon.openDatabaseOnSuccess.bind(request, context);
  request.onerror = favicon.openDatabaseOnError.bind(request, context);
  request.onblocked = favicon.openDatabaseOnBlocked.bind(request, context);
};

favicon.onUpgradeNeeded = function(context, event) {
  console.log('Creating or upgrading database', context.databaseName);
  const connection = event.target.result;
  if(!connection.objectStoreNames.contains('favicon-cache')) {
    connection.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
};

favicon.openDatabaseOnError = function(context, event) {
  console.error(event);
  context.callback();
};

favicon.openDatabaseOnBlocked = function(context, event) {
  console.error('Connection to database blocked', context.databaseName, event);
  context.callback();
};

favicon.openDatabaseOnSuccess = function(context, event) {
  // console.debug('Connected to database', context.databaseName);

  // Cache the connection in the context for use in other functions
  context.connection = event.target.result;

  // If the caller provided a pre-fetched document, start by looking for the
  // icon in the document.
  if(context.document) {
    const iconURL = favicon.searchDocument(context.document, context.url);
    if(iconURL) {
      // Add or update the associated entry in the cache
      favicon.addEntry(context, context.url, iconURL);
      context.connection.close();
      context.callback(iconURL);
      return;
    }
  }

  // If a document was not provided or we didn't find an icon in the page,
  // then search the cache
  favicon.findEntry(context, context.url,
    favicon.onLookupRequestURL.bind(null, context));
};

favicon.onLookupRequestURL = function(context, entry) {
  // Cache the entry in the context for later use. It may be undefined.
  context.entry = entry;

  if(entry && !favicon.isExpired(context, entry)) {
    // We found an icon in the cache, callback
    context.connection.close();
    const iconURL = new URL(entry.iconURLString);
    context.callback(iconURL);
  } else {
    // We didn't find a non-expired entry in the cache, so fetch the document
    console.debug('Cache miss', context.url.href);
    favicon.fetchHTML(context);
  }
};

favicon.isExpired = function(context, entry) {
  const age = new Date() - entry.dateUpdated;
  return age >= context.expiresAfterMillis;
};

favicon.fetchHTML = function(context) {
  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Offline, unable to fetch %s', context.url.href);
    if(context.connection) {
      context.connection.close();
    }

    if(context.entry) {
      console.debug('Offline, falling back to expired entry', context.entry);
      context.callback(new URL(context.entry.iconURLString));
    } else {
      context.callback();
    }
    return;
  }

  console.debug('GET', context.url.href);
  const request = new XMLHttpRequest();

  if(context.timeout) {
    request.timeout = context.timeout;
  }

  request.responseType = 'document';

  const onFetch = favicon.onFetchHTML.bind(request, context);
  request.onerror = onFetch;
  request.ontimeout = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('GET', context.url.href, true);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

favicon.onFetchHTML = function(context, event) {
  if(event.type !== 'load') {
    console.debug('Error fetching url', event.type, context.url.href);

    // If we failed to fetch and the entry was expired, delete the expired
    // entry.
    if(context.entry) {
      favicon.deleteEntry(context, context.url);
    }

    // Skip to searching the cache for the origin url
    favicon.lookupOrigin(context, null);
    return;
  }

  const document = event.target.responseXML;

  // Get the redirect url. It is guaranteed defined if event.type === 'load'
  // It is also valid so this will never throw.
  const responseURL = new URL(event.target.responseURL);

  if(!document) {
    favicon.lookupRedirect(context, responseURL);
    return;
  }

  // We successfully fetched the page. Search the page for favicons. Use the
  // responseURL as the baseURL.
  const iconURL = favicon.searchDocument(document, responseURL);
  if(iconURL) {
    console.debug('Found icon in page', context.url.href, iconURL.href);
    favicon.addEntry(context, context.url, iconURL);

    // Also add an entry for the redirect url if it differs
    if(responseURL.href !== context.url.href) {
      favicon.addEntry(context, responseURL, iconURL);
    }

    // TODO: I should also add origin url here if it is distinct?
    context.connection.close();
    context.callback(iconURL);
  } else {
    console.debug('No icons found in page', context.url.href);
    favicon.lookupRedirect(context, responseURL);
  }
};

favicon.lookupRedirect = function(context, redirectURL) {
  // If the redirect url differs from the request url, then search the
  // cache for the redirect url. Otherwise, fallback to searching the cache
  // for the origin.
  if(redirectURL && redirectURL.href !== context.url.href) {
    console.debug('Looking up redirect', redirectURL.href);
    favicon.findEntry(context, redirectURL,
      favicon.onLookupRedirect.bind(null, context, redirectURL));
  } else {
    favicon.lookupOrigin(context, redirectURL);
  }
};

favicon.onLookupRedirect = function(context, redirectURL, entry) {
  if(entry && !favicon.isExpired(context, entry)) {
    console.debug('Found redirect entry in cache', entry);
    // We only reached here if the lookup for the request url failed,
    // so add the request url to the cache as well, using the redirect url
    // icon. The lookup failed because the request url entry expired or because
    // it didn't exist. If the entry expired it will be replaced here.
    const iconURL = new URL(entry.iconURLString);
    favicon.addEntry(context, context.url, iconURL);

    context.connection.close();
    context.callback(iconURL);
  } else {
    console.debug('Did not find redirect url', redirectURL.href);
    favicon.lookupOrigin(context, redirectURL);
  }
};

favicon.lookupOrigin = function(context, redirectURL) {
  const originURL = new URL(context.url.origin);
  const originIconURL = new URL(context.url.origin + '/favicon.ico');
  if(favicon.isOriginDifferent(context.url, redirectURL, originURL)) {
    console.debug('Searching cache for origin', originURL.href);
    favicon.findEntry(context, originURL,
      favicon.onLookupOrigin.bind(null, context, redirectURL));
  } else {
    favicon.requestImageHead(originIconURL,
      favicon.onFetchOrigin.bind(null, context, redirectURL));
  }
};

favicon.onLookupOrigin = function(context, redirectURL, entry) {

  if(entry && !favicon.isExpired(context, entry)) {
    console.debug('Found origin entry in cache', entry);

    // Associate the origin's icon with the request url
    const iconURL = new URL(entry.iconURLString);
    if(context.url.href !== context.url.origin) {
      favicon.addEntry(context, context.url, iconURL);
    }

    // Associate the origin's icon with the redirect url
    if(context.url.origin !== redirectURL.href) {
      favicon.addEntry(context, redirectURL, iconURL);
    }

    context.connection.close();
    context.callback(iconURL);
  } else {
    const originIconURL = new URL(context.url.origin + '/favicon.ico');
    favicon.requestImageHead(originIconURL,
      favicon.onFetchOrigin.bind(null, context, redirectURL));
  }
};

favicon.onFetchOrigin = function(context, redirectURL, iconURLString) {
  const originURL = new URL(context.url.origin);

  if(iconURLString) {
    // If sending a head request yielded a url, associate the urls with the
    // icon in the cache and callback.
    const iconURL = new URL(iconURLString);
    favicon.addEntry(context, context.url, iconURL);
    if(redirectURL && redirectURL.href !== context.url.href) {
      favicon.addEntry(context, redirectURL, iconURL);
    }
    if(favicon.isOriginDifferent(context.url, redirectURL, originURL)) {
      favicon.addEntry(context, originURL, iconURL);
    }

    context.connection.close();
    context.callback(iconURL);
  } else {
    // We failed to find anything. Ensure there is nothing in the cache.
    // TODO: what about falling back to expired request entry or redirect entry?

    favicon.deleteEntry(context, context.url);
    if(redirectURL && redirectURL.href !== context.url.href) {
      favicon.deleteEntry(context, redirectURL);
    }

    if(favicon.isOriginDifferent(context.url, redirectURL, originURL)) {
      favicon.deleteEntry(context, originURL);
    }

    context.connection.close();
    context.callback();
  }
};

favicon.searchDocument = function(document, baseURL) {
  console.debug('Searching for icons in page', baseURL.href);

  if(document.documentElement.localName !== 'html') {
    return;
  }

  const headElement = document.head;
  if(!headElement) {
    return;
  }

  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

  // NOTE: that it is important to check if href is defined and not empty in
  // the loop because otherwise this tries to construct a new URL object using
  // an empty string as the first argument, in which case it would not be throw
  // an exception and instead create a valid url representing the base url, but
  // that isn't what we want to allow.

  for(let selector of selectors) {
    const element = headElement.querySelector(selector);
    if(element) {
      const href = (element.getAttribute('href') || '').trim();
      if(href) {
        try {
          const iconURL = new URL(href, baseURL);
          console.debug('Found element identifying favicon', element.outerHTML);
          return iconURL;
        } catch(urlParseError) {
          console.warn(urlParseError);
        }
      }
    }
  }
};

favicon.isOriginDifferent = function(pageURL, redirectURL, originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
};

favicon.requestImageHead = function(imageURL, callback) {
  console.debug('HEAD', imageURL.href);
  const request = new XMLHttpRequest();
  const onResponse = favicon.onRequestImageHead.bind(request, imageURL,
    callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imageURL.href, true);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
};

favicon.onRequestImageHead = function(imageURL, callback, event) {
  const contentLength = event.target.getResponseHeader('Content-Length');
  const contentType = event.target.getResponseHeader('Content-Type');

  if(event.type === 'load' && favicon.isInRange(contentLength) &&
    favicon.isMimeTypeImage(contentType)) {
    callback(event.target.responseURL);
  } else {
    callback();
  }
};

favicon.isInRange = function(contentLength) {
  let numBytes = 0;
  try {
    numBytes = parseInt(contentLength, 10);
  } catch(parseIntError) {
    console.warn(parseIntError);
  }
  return numBytes >= 50 && numBytes <= 10000;
};

favicon.isMimeTypeImage = function(mimeType) {
  return /^\s*image\//i.test(mimeType);
};

favicon.findEntry = function(context, url, callback) {
  //console.debug('Searching favicon cache for entry with url', url.href);
  const pageURLString = favicon.normalizeURL(url).href;
  const transaction = context.connection.transaction('favicon-cache');
  const store = transaction.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = function(event) {
    if(event.target.result) {
      console.debug('Found favicon entry', url.href,
        event.target.result.iconURLString);
      callback(event.target.result);
    } else {
      callback();
    }
  };
  request.onerror = function(event) {
    console.error('Error searching for favicon cache entry', url.href, event);
    callback();
  };
};

favicon.addEntry = function(context, pageURL, iconURL) {
  const entry = {
    'pageURLString': favicon.normalizeURL(pageURL).href,
    'iconURLString': iconURL.href,
    'dateUpdated': new Date()
  };
  console.debug('Caching entry', entry);
  const transaction = context.connection.transaction('favicon-cache',
    'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.put(entry);
};

favicon.deleteEntry = function(context, pageURL) {
  console.debug('Deleting entry', pageURL.href);
  const transaction = context.connection.transaction('favicon-cache',
    'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.delete(favicon.normalizeURL(pageURL).href);
};

favicon.normalizeURL = function(url) {
  const outputURL = favicon.cloneURL(url);
  if(outputURL.hash) {
    outputURL.hash = '';
  }
  return outputURL;
};

favicon.cloneURL = function(url) {
  return new URL(url.href);
};

favicon.compact = function() {
  console.debug('Compacting favicon-cache');
  // TODO: declare a context to track numDeletes

  // TODO: avoid DRY
  const request = indexedDB.open('favicon-cache', 1);
  request.onsuccess = favicon.compactOnOpenDatabase;
  request.onerror = favicon.compactOnOpenDatabase;
  request.onblocked = favicon.compactOnOpenDatabase;
};

favicon.compactOnOpenDatabase = function(event) {
  const connection = event.target.result;
  if(!connection) {
    console.error(event);
    return;
  }

  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = favicon.compactOpenCursorOnSuccess;
  request.onerror = favicon.compactOpenCursorOnError;
};

favicon.compactOpenCursorOnSuccess = function(event) {

  const cursor = event.target.result;
  if(!cursor) {
    // no entries or all entries iterated
    // TODO: close connection

    console.log('Finished compacting database favicon-cache');
    return;
  }

  const entry = cursor.value;

  // If expired, delete
  // TODO: this should be shared with lookupFavicon somehow, not duplicated
  // Maybe via an external parameter? It doesn't need to be the same value but
  // it should be called in a similar way, and should also share the logic
  // of favicon.isExpired
  // TODO: and maybe I should be creating one date for the call to compact,
  // not a new date per cursor callback
  const expiresAfterMillis = 1000 * 60 * 60 * 24 * 30;
  const age = new Date() - entry.dateUpdated;
  if(age >= expiresAfterMillis) {
    console.debug('Deleting favicon entry', entry);
    cursor.delete();
  }

  cursor.continue();
};

favicon.compactOpenCursorOnError = function(event) {
  // TODO: close the database connection, need to get it from the event
  console.error(event);
};
