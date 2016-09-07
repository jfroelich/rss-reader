// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

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
    'db_name': 'favicon-cache',
    'db_version': 1,
    'expires_after_ms': 1000 * 60 * 60 * 24 * 30,
    'callback': callback,
    'document': document,
    'connection': null,
    'entry': null,
    'timeout': null
  };

  const name = 'favicon-cache';
  const version = 1;
  const request = indexedDB.open(context.db_name, context.db_version);
  request.onupgradeneeded = on_upgrade_needed.bind(request, context);
  request.onsuccess = open_db_onsuccess.bind(request, context);
  request.onerror = open_db_onerror.bind(request, context);
  request.onblocked = open_db_onblocked.bind(request, context);
};

function on_upgrade_needed(context, event) {
  console.log('Creating or upgrading database', context.db_name);
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
    const icon_url = search_document(context.document, context.url);
    if(icon_url) {
      add_entry(context, context.url, icon_url);
      context.connection.close();
      context.callback(icon_url);
      return;
    }
  }

  find_entry(context, context.url, on_find_request_url.bind(null, context));
}

function on_find_request_url(context, entry) {
  context.entry = entry;
  if(entry && !is_expired(context, entry)) {
    context.connection.close();
    const icon_url = new URL(entry.iconURLString);
    context.callback(icon_url);
  } else {
    console.debug('MISS', context.url.href);
    fetch_html(context);
  }
}

function is_expired(context, entry) {
  const age = new Date() - entry.dateUpdated;
  return age >= context.expires_after_ms;
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
  const async_flag = true;
  const request = new XMLHttpRequest();
  const bound_on_response = on_fetch_html.bind(request, context);
  request.timeout = context.timeout;
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
  const response_url = new URL(event.target.responseURL);

  if(!document) {
    lookup_redirect(context, response_url);
    return;
  }

  // We successfully fetched the page. Search the page for favicons. Use the
  // responseURL as the baseURL.
  const icon_url = search_document(document, response_url);
  if(icon_url) {
    console.debug('Found icon in page', context.url.href, icon_url.href);
    add_entry(context, context.url, icon_url);

    // Also add an entry for the redirect url if it differs
    if(response_url.href !== context.url.href) {
      add_entry(context, response_url, icon_url);
    }

    // TODO: I should also add origin url here if it is distinct?
    context.connection.close();
    context.callback(icon_url);
  } else {
    console.debug('No icons found in page', context.url.href);
    lookup_redirect(context, response_url);
  }
}

function lookup_redirect(context, redirect_url) {
  // If the redirect url differs from the request url, then search the
  // cache for the redirect url. Otherwise, fallback to searching the cache
  // for the origin.
  if(redirect_url && redirect_url.href !== context.url.href) {
    console.debug('Looking up redirect', redirect_url.href);
    find_entry(context, redirect_url,
      on_lookup_redirect.bind(null, context, redirect_url));
  } else {
    lookup_origin(context, redirect_url);
  }
}

function on_lookup_redirect(context, redirect_url, entry) {
  if(entry && !is_expired(context, entry)) {
    console.debug('Found redirect entry in cache', entry);
    // We only reached here if the lookup for the request url failed,
    // so add the request url to the cache as well, using the redirect url
    // icon. The lookup failed because the request url entry expired or because
    // it didn't exist. If the entry expired it will be replaced here.
    const icon_url = new URL(entry.iconURLString);
    add_entry(context, context.url, icon_url);
    context.connection.close();
    context.callback(icon_url);
  } else {
    console.debug('Did not find redirect url', redirect_url.href);
    lookup_origin(context, redirect_url);
  }
}

function lookup_origin(context, redirect_url) {
  const origin_url = new URL(context.url.origin);
  const origin_icon_url = new URL(context.url.origin + '/favicon.ico');
  if(is_origin_diff(context.url, redirect_url, origin_url)) {
    console.debug('Searching cache for origin', origin_url.href);
    find_entry(context, origin_url,
      on_lookup_origin.bind(null, context, redirect_url));
  } else {
    request_image_head(origin_icon_url,
      on_fetch_origin.bind(null, context, redirect_url));
  }
}

function on_lookup_origin(context, redirect_url, entry) {

  if(entry && !is_expired(context, entry)) {
    console.debug('Found origin entry in cache', entry);

    // Associate the origin's icon with the request url
    const icon_url = new URL(entry.iconURLString);
    if(context.url.href !== context.url.origin) {
      add_entry(context, context.url, icon_url);
    }

    // Associate the origin's icon with the redirect url
    if(context.url.origin !== redirect_url.href) {
      add_entry(context, redirect_url, icon_url);
    }

    context.connection.close();
    context.callback(icon_url);
  } else {
    const origin_icon_url = new URL(context.url.origin + '/favicon.ico');
    request_image_head(origin_icon_url,
      on_fetch_origin.bind(null, context, redirect_url));
  }
}

function on_fetch_origin(context, redirect_url, icon_url_string) {
  const origin_url = new URL(context.url.origin);

  if(icon_url_string) {
    // If sending a head request yielded a url, associate the urls with the
    // icon in the cache and callback.
    const icon_url = new URL(icon_url_string);
    add_entry(context, context.url, icon_url);
    if(redirect_url && redirect_url.href !== context.url.href) {
      add_entry(context, redirect_url, icon_url);
    }
    if(is_origin_diff(context.url, redirect_url, origin_url)) {
      add_entry(context, origin_url, icon_url);
    }

    context.connection.close();
    context.callback(icon_url);
  } else {
    // We failed to find anything. Ensure there is nothing in the cache.
    // TODO: what about falling back to expired request entry or redirect entry?

    delete_entry(context, context.url);
    if(redirect_url && redirect_url.href !== context.url.href) {
      delete_entry(context, redirect_url);
    }

    if(is_origin_diff(context.url, redirect_url, origin_url)) {
      delete_entry(context, origin_url);
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
          const icon_url = new URL(href, baseURL);
          return icon_url;
        } catch(error) {
          console.warn(error);
        }
      }
    }
  }
}

function is_origin_diff(page_url, redirect_url, origin_url) {
  return origin_url.href !== page_url.href &&
    (!redirect_url || redirect_url.href !== origin_url.href);
}

function request_image_head(img_url, callback) {
  console.debug('HEAD', img_url.href);
  const request = new XMLHttpRequest();
  const async_flag = true;
  const bound_on_response =
    on_request_image_head.bind(request, img_url, callback);
  request.timeout = 1000;
  request.ontimeout = bound_on_response;
  request.onerror = bound_on_response;
  request.onabort = bound_on_response;
  request.onload = bound_on_response;
  request.open('HEAD', img_url.href, async_flag);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
}

function on_request_image_head(img_url, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const content_length = event.target.getResponseHeader('Content-Length');
  let num_bytes = 0;
  if(content_length) {
    try {
      num_bytes = parseInt(content_length, 10);
    } catch(error) {
    }
  }


  if(num_bytes < 50 || num_bytes > 10000) {
    callback();
    return;
  }

  const content_type = event.target.getResponseHeader('Content-Type');
  if(content_type && !/^\s*image\//i.test(content_type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
}

function find_entry(context, url, callback) {
  const page_url_string = normalize_url(url).href;
  const transaction = context.connection.transaction('favicon-cache');
  const store = transaction.objectStore('favicon-cache');
  const request = store.get(page_url_string);
  request.onsuccess = function(event) {
    if(event.target.result) {
      console.debug('HIT', url.href, event.target.result.iconURLString);
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

function add_entry(context, page_url, icon_url) {
  const entry = {
    'pageURLString': normalize_url(page_url).href,
    'iconURLString': icon_url.href,
    'dateUpdated': new Date()
  };
  console.debug('Caching', entry);
  const connection = context.connection;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.put(entry);
}

function delete_entry(context, page_url) {
  console.debug('Deleting', page_url.href);
  const connection = context.connection;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.delete(normalize_url(page_url).href);
}

function normalize_url(url) {
  const output_url = clone_url(url);
  if(output_url.hash) {
    output_url.hash = '';
  }
  return output_url;
}

function clone_url(url) {
  return new URL(url.href);
}

} // End file block scope
