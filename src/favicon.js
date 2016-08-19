// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: there are two block scopes in this file
{ // Begin lookup_favicon block scope

// Finds the url of the favicon associated with the given document url
// @param url {URL} - document url to lookup
// @param document {Document} - optional prefetched document, should be set if
// available because it potentially avoids network
// @param callback {function} - callback function passed the favicon url
// (type URL, not string).
this.lookup_favicon = function(url, document, callback) {
  console.assert(url);
  console.assert(url.href);

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

  const name = 'favicon-cache';
  const version = 1;
  const request = indexedDB.open(context.databaseName, context.databaseVersion);
  request.onupgradeneeded = on_upgrade_needed.bind(request, context);
  request.onsuccess = open_db_onsuccess.bind(request, context);
  request.onerror = open_db_onerror.bind(request, context);
  request.onblocked = open_db_onblocked.bind(request, context);
};

function on_upgrade_needed(context, event) {
  console.log('Creating or upgrading database', context.databaseName);
  const connection = event.target.result;
  if(!connection.objectStoreNames.contains('favicon-cache')) {
    connection.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
}

function open_db_onerror(context, event) {
  console.error(event.target.error);
  context.callback();
}

function open_db_onblocked(context, event) {
  console.error(event.target.error);
  context.callback();
}

function open_db_onsuccess(context, event) {
  context.connection = event.target.result;

  // TODO: maybe the doc search should defer until after cache lookup, there
  // is a db call either way sometimes

  if(context.document) {
    const iconURL = search_document(context.document, context.url);
    if(iconURL) {
      add_entry(context, context.url, iconURL);
      context.connection.close();
      context.callback(iconURL);
      return;
    }
  }

  find_entry(context, context.url, on_find_request_url.bind(null, context));
}

function on_find_request_url(context, entry) {
  context.entry = entry;
  if(entry && !is_expired(context, entry)) {
    context.connection.close();
    const iconURL = new URL(entry.iconURLString);
    context.callback(iconURL);
  } else {
    console.debug('Cache miss', context.url.href);
    fetch_html(context);
  }
}

function is_expired(context, entry) {
  const age = new Date() - entry.dateUpdated;
  return age >= context.expiresAfterMillis;
}

function fetch_html(context) {
  if('onLine' in navigator && !navigator.onLine) {
    if(context.connection) {
      context.connection.close();
    }

    if(context.entry) {
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

  const bound_on_response = on_fetch_html.bind(request, context);
  const async_flag = true;
  request.responseType = 'document';
  request.onerror = bound_on_response;
  request.ontimeout = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('GET', context.url.href, async_flag);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function on_fetch_html(context, event) {
  if(event.type !== 'load') {
    console.debug('Error fetching url', event.type, context.url.href);

    // If we failed to fetch and the entry was expired, delete the expired
    // entry.
    if(context.entry) {
      delete_entry(context, context.url);
    }

    // Skip to searching the cache for the origin url
    lookup_origin(context, null);
    return;
  }

  const document = event.target.responseXML;

  // Get the redirect url. It is guaranteed defined if event.type === 'load'
  // It is also valid so this will never throw.
  const responseURL = new URL(event.target.responseURL);

  if(!document) {
    lookup_redirect(context, responseURL);
    return;
  }

  // We successfully fetched the page. Search the page for favicons. Use the
  // responseURL as the baseURL.
  const iconURL = search_document(document, responseURL);
  if(iconURL) {
    console.debug('Found icon in page', context.url.href, iconURL.href);
    add_entry(context, context.url, iconURL);

    // Also add an entry for the redirect url if it differs
    if(responseURL.href !== context.url.href) {
      add_entry(context, responseURL, iconURL);
    }

    // TODO: I should also add origin url here if it is distinct?
    context.connection.close();
    context.callback(iconURL);
  } else {
    console.debug('No icons found in page', context.url.href);
    lookup_redirect(context, responseURL);
  }
}

function lookup_redirect(context, redirectURL) {
  // If the redirect url differs from the request url, then search the
  // cache for the redirect url. Otherwise, fallback to searching the cache
  // for the origin.
  if(redirectURL && redirectURL.href !== context.url.href) {
    console.debug('Looking up redirect', redirectURL.href);
    find_entry(context, redirectURL,
      on_lookup_redirect.bind(null, context, redirectURL));
  } else {
    lookup_origin(context, redirectURL);
  }
}

function on_lookup_redirect(context, redirectURL, entry) {
  if(entry && !is_expired(context, entry)) {
    console.debug('Found redirect entry in cache', entry);
    // We only reached here if the lookup for the request url failed,
    // so add the request url to the cache as well, using the redirect url
    // icon. The lookup failed because the request url entry expired or because
    // it didn't exist. If the entry expired it will be replaced here.
    const iconURL = new URL(entry.iconURLString);
    add_entry(context, context.url, iconURL);
    context.connection.close();
    context.callback(iconURL);
  } else {
    console.debug('Did not find redirect url', redirectURL.href);
    lookup_origin(context, redirectURL);
  }
}

function lookup_origin(context, redirectURL) {
  const originURL = new URL(context.url.origin);
  const originIconURL = new URL(context.url.origin + '/favicon.ico');
  if(is_origin_diff(context.url, redirectURL, originURL)) {
    console.debug('Searching cache for origin', originURL.href);
    find_entry(context, originURL,
      on_lookup_origin.bind(null, context, redirectURL));
  } else {
    request_image_head(originIconURL,
      on_fetch_origin.bind(null, context, redirectURL));
  }
}

function on_lookup_origin(context, redirectURL, entry) {

  if(entry && !is_expired(context, entry)) {
    console.debug('Found origin entry in cache', entry);

    // Associate the origin's icon with the request url
    const iconURL = new URL(entry.iconURLString);
    if(context.url.href !== context.url.origin) {
      add_entry(context, context.url, iconURL);
    }

    // Associate the origin's icon with the redirect url
    if(context.url.origin !== redirectURL.href) {
      add_entry(context, redirectURL, iconURL);
    }

    context.connection.close();
    context.callback(iconURL);
  } else {
    const originIconURL = new URL(context.url.origin + '/favicon.ico');
    request_image_head(originIconURL,
      on_fetch_origin.bind(null, context, redirectURL));
  }
}

function on_fetch_origin(context, redirectURL, iconURLString) {
  const originURL = new URL(context.url.origin);

  if(iconURLString) {
    // If sending a head request yielded a url, associate the urls with the
    // icon in the cache and callback.
    const iconURL = new URL(iconURLString);
    add_entry(context, context.url, iconURL);
    if(redirectURL && redirectURL.href !== context.url.href) {
      add_entry(context, redirectURL, iconURL);
    }
    if(is_origin_diff(context.url, redirectURL, originURL)) {
      add_entry(context, originURL, iconURL);
    }

    context.connection.close();
    context.callback(iconURL);
  } else {
    // We failed to find anything. Ensure there is nothing in the cache.
    // TODO: what about falling back to expired request entry or redirect entry?

    delete_entry(context, context.url);
    if(redirectURL && redirectURL.href !== context.url.href) {
      delete_entry(context, redirectURL);
    }

    if(is_origin_diff(context.url, redirectURL, originURL)) {
      delete_entry(context, originURL);
    }

    context.connection.close();
    context.callback();
  }
}

const SELECTORS = [
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
function search_document(document, baseURL) {
  if(document.documentElement.localName !== 'html' || !document.head) {
    return;
  }

  for(let selector of SELECTORS) {
    const element = document.head.querySelector(selector);
    if(element) {
      const href = (element.getAttribute('href') || '').trim();
      if(href) {
        try {
          const iconURL = new URL(href, baseURL);
          return iconURL;
        } catch(error) {
          console.warn(error);
        }
      }
    }
  }
}

function is_origin_diff(pageURL, redirectURL, originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
}

function request_image_head(imageURL, callback) {
  console.debug('HEAD', imageURL.href);
  const request = new XMLHttpRequest();
  const onResponse = on_request_image_head.bind(request, imageURL, callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imageURL.href, true);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
}

function on_request_image_head(imageURL, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const contentLength = event.target.getResponseHeader('Content-Length');
  let numBytes = 0;
  if(contentLength) {
    try {
      numBytes = parseInt(contentLength, 10);
    } catch(error) {
    }
  }


  if(numBytes < 50 || numBytes > 10000) {
    callback();
    return;
  }

  const contentType = event.target.getResponseHeader('Content-Type');
  if(contentType && !/^\s*image\//i.test(contentType)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
}

function find_entry(context, url, callback) {
  const pageURLString = normalize_url(url).href;
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
}

function add_entry(context, pageURL, iconURL) {
  const entry = {
    'pageURLString': normalize_url(pageURL).href,
    'iconURLString': iconURL.href,
    'dateUpdated': new Date()
  };
  console.debug('Caching', entry);
  const connection = context.connection;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.put(entry);
}

function delete_entry(context, pageURL) {
  console.debug('Deleting', pageURL.href);
  const connection = context.connection;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.delete(normalize_url(pageURL).href);
}

function normalize_url(url) {
  const outputURL = clone_url(url);
  if(outputURL.hash) {
    outputURL.hash = '';
  }
  return outputURL;
}

function clone_url(url) {
  return new URL(url.href);
}

} // End lookup_favicon block scope

{ // Begin compact block scope

this.compact_favicon_cache = function() {
  console.log('Compacting favicon-cache');
  // TODO: declare a context to track numDeletes

  // TODO: avoid DRY
  const request = indexedDB.open('favicon-cache', 1);
  request.onsuccess = on_open_db;
  request.onerror = on_open_db;
  request.onblocked = on_open_db;
};

function on_open_db(event) {
  const connection = event.target.result;
  if(!connection) {
    console.error(event);
    return;
  }

  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = open_cursor_onsuccess;
  request.onerror = open_cursor_onerror;
}

function open_cursor_onsuccess(event) {

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
  // of is_expired
  // TODO: and maybe I should be creating one date for the call to compact,
  // not a new date per cursor callback
  const expiresAfterMillis = 1000 * 60 * 60 * 24 * 30;
  const age = new Date() - entry.dateUpdated;
  if(age >= expiresAfterMillis) {
    console.debug('Deleting favicon entry', entry);
    cursor.delete();
  }

  cursor.continue();
}

function open_cursor_onerror(event) {
  // TODO: close the database connection, need to get it from the event
  console.error(event);
}

} // End compact block scope
