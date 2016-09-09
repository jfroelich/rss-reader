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
function lookup_favicon(url, document, callback) {
  console.assert(url);
  console.assert(url.href);
  console.assert(callback);

  const context = {
    'url': url,
    'db_name': 'favicon-cache',
    'db_version': 1,
    'expires': DEFAULT_EXPIRATION,
    'callback': callback,
    'document': document,
    'db': null,
    'entry': null,
    'timeout': null
  };

  favicon_connect(connect_onsuccess.bind(context),
    connect_onerror.bind(context));
}

function connect_onsuccess(event) {
  this.db = event.target.result;

  // Upon connecting to the database, search the document. If an icon is found,
  // then update the cache entry for the url and callback. Do not try and update
  // the origin icon url because it could be different. If a document was not
  // provided or we cannot find the icon in the document, then fall back to
  // searching the cache for the request url as normal.
  if(this.document) {
    const icon_url = search_document(this.document, this.url);
    if(icon_url) {
      favicon_add_entry(this.db, this.url, icon_url);
      lookup_favicon_oncomplete.call(this, icon_url);
      return;
    }
  }

  favicon_find_entry(this.db, this.url, on_find_request_url.bind(this));
}

function connect_onerror(event) {
  console.error(event.target.error);

  // If we cannot connect to the database, fallback to checking if a document
  // was provided and search the document. If we found an icon then update the
  // icon_url variable. Otherwise leave it undefined. Then callback.
  let icon_url;
  if(this.document) {
    icon_url = search_document(this.document, this.url);
  }

  lookup_favicon_oncomplete.call(this, icon_url);
}

function on_find_request_url(entry) {
  this.entry = entry;

  // If we didn't find a cache entry, then fallback to fetching the content
  // of the url
  if(!entry) {
    console.debug('MISS', this.url.href);
    fetch_html.call(this);
    return;
  }

  // If we did find an entry, but it is expired, then fallback to fetching the
  // content of the url.
  if(is_entry_expired(entry, this.expires)) {
    console.debug('Favicon entry expired', this.url.href);
    fetch_html.call(this);
    return;
  }

  // We found an non-expired entry. Callback.
  const icon_url = new URL(entry.iconURLString);
  lookup_favicon_oncomplete.call(this, icon_url);
}

// Returns true if the entry is older than or equal to the expiration period.
function is_entry_expired(entry, expires) {
  console.assert(entry);
  // Subtracting two dates yields the difference in ms
  const age = new Date() - entry.dateUpdated;
  return age >= expires;
}

function fetch_html() {
  // If offline, and there was a cache hit, then fallback to using the expired
  // entry. If offline and no cache hit, then we are done.
  if('onLine' in navigator && !navigator.onLine) {
    let icon_url;
    if(this.entry) {
      icon_url = new URL(this.entry.iconURLString);
    }
    lookup_favicon_oncomplete.call(this, icon_url);
    return;
  }

  // Proceed with sending a request for the document.
  console.debug('GET', this.url.href);
  const async_flag = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = fetch_html_onerror.bind(this);
  request.ontimeout = fetch_html_ontimeout.bind(this);
  request.onabort = fetch_html_onabort.bind(this);
  request.onload = fetch_html_onsuccess.bind(this);
  request.open('GET', this.url.href, async_flag);
  // Attempt to limit the validity of the response
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function fetch_html_onabort(event) {
  console.debug(event.type, this.url.href);

  // If the fetch was aborted for some reason, then assume we shouldn't take
  // any additional action. Exit immediately without an icon url.
  lookup_favicon_oncomplete.call(this);
}

function fetch_html_onerror(event) {
  console.debug(event.type, this.url.href);

  // If entry is defined, then that means we found a cache hit earlier, but
  // decided to fetch because the entry was expired. Because we then encountered
  // an error fetching, consider the url to be no longer valid, so delete the
  // entry from the cache. If the url is looked up again, then it will skip the
  // cache lookup and go straight to the fetch and possibly recreate itself.
  if(this.entry) {
    favicon_delete_entry(this.db, this.url);
  }

  // Fallback to looking up the origin. Cannot use response url.
  lookup_origin.call(this);
}

function fetch_html_ontimeout(event) {
  console.debug(event.type, this.url.href);
  // If we timed out trying to fetch the url, then fallback to checking the
  // origin. We cannot use the redirect url in this case because it is unknown.
  // Unlike onerror, this does not delete the entry, because a timeout may be
  // temporary. However, it may end up associating the request url with the
  // origin icon url, overwriting the entry for the request url that may have
  // existed prior to the lookup.
  lookup_origin.call(this);
}

function fetch_html_onsuccess(event) {
  console.assert(event.type === 'load');

  // If the fetch was successful then the redirect url will be defined and
  // will be valid. If no redirect occurred, then it will be equal to the
  // request url.
  const response_url = new URL(event.target.responseURL);

  const document = event.target.responseXML;

  // If we successfully fetched the document but the response did not provide
  // a document, then consider the fetch a failure. Fallback to looking for the
  // redirect url in the cache. This is different from the other fetch errors
  // because this time the redirect url is available.
  if(!document) {
    lookup_redirect.call(this, response_url);
    return;
  }

  // We successfully fetched a document. Search the page for favicons. Use the
  // response url as the base url to ensure we use the proper url in the event
  // of a redirect
  const icon_url = search_document(document, response_url);
  if(icon_url) {
    console.debug('Found icon in page', this.url.href, icon_url.href);

    // Cache an entry for the request url
    favicon_add_entry(this.db, this.url, icon_url);

    // Cache an entry for the redirect url if it is different than the request
    // url
    if(response_url.href !== this.url.href) {
      favicon_add_entry(this.db, response_url, icon_url);
    }

    // An origin entry may exist, but leave it alone. The origin is the fallback
    // to the in-page icon, because each page in a domain can have its own
    // custom favicon.

    lookup_favicon_oncomplete.call(this, icon_url);
  } else {
    console.debug('No icons found in page', this.url.href);
    // We successfully fetched the document for the request url, but did not
    // find any icons in its content. Fallback to looking for the redirect url
    // in the cache.
    lookup_redirect.call(this, response_url);
  }
}

function lookup_redirect(redirect_url) {
  // If the redirect url differs from the request url, then search the
  // cache for the redirect url. Otherwise, fallback to searching the cache
  // for the origin.
  if(redirect_url && redirect_url.href !== this.url.href) {
    const on_lookup = on_lookup_redirect.bind(this, redirect_url);
    favicon_find_entry(this.db, redirect_url, on_lookup);
  } else {
    lookup_origin.call(this, redirect_url);
  }
}

function on_lookup_redirect(redirect_url, entry) {
  if(entry && !is_entry_expired(entry, this.expires)) {
    console.debug('Found non-expired redirect entry in cache', entry);
    // We only reached here if the lookup for the request url failed,
    // so add the request url to the cache as well, using the redirect url
    // icon. The lookup failed because the request url entry expired or because
    // it didn't exist or possibly because there was no icon found in the page.
    // If the entry expired it will be replaced here.
    const icon_url = new URL(entry.iconURLString);
    favicon_add_entry(this.db, this.url, icon_url);

    // We don't need to re-add the redirect url here. We are done.
    // We don't modify the origin entry if it exists here, because per-page
    // icons take priority over the default domain-wide root icon.
    lookup_favicon_oncomplete.call(this, icon_url);
  } else {
    // If we failed to find the redirect url in the cache, then fallback to
    // looking for the origin.
    console.debug('Did not find redirect url', redirect_url.href);
    lookup_origin.call(this, redirect_url);
  }
}

function lookup_origin(redirect_url) {
  const origin_url = new URL(this.url.origin);
  const origin_icon_url = new URL(this.url.origin + '/favicon.ico');

  // If the origin url is distinct from the request and response urls, then
  // lookup the origin in the cache. Otherwise, fallback to fetching the
  // the favicon url in the domain root.
  if(is_origin_diff(this.url, redirect_url, origin_url)) {
    favicon_find_entry(this.db, origin_url,
      on_lookup_origin.bind(this, redirect_url));
  } else {
    send_image_head_request(origin_icon_url,
      on_fetch_origin.bind(this, redirect_url));
  }
}

function on_lookup_origin(redirect_url, entry) {
  if(entry && !is_entry_expired(entry, this.expires)) {
    // Associate the origin's icon with the request url if it differs
    const icon_url = new URL(entry.iconURLString);
    if(this.url.href !== this.url.origin) {
      favicon_add_entry(this.db, this.url, icon_url);
    }

    // Associate the origin's icon with the redirect url if it differs
    if(this.url.origin !== redirect_url.href) {
      favicon_add_entry(this.db, redirect_url, icon_url);
    }

    lookup_favicon_oncomplete.call(this, icon_url);
  } else {
    // Fallback to searching the domain root
    const origin_icon_url = new URL(this.url.origin + '/favicon.ico');
    send_image_head_request(origin_icon_url,
      on_fetch_origin.bind(this, redirect_url));
  }
}

// redirect_url is the redirect url of the request url given to lookup_favicon,
// it is not to be confused with the possible redirect that occured from the
// head request for the image.
function on_fetch_origin(redirect_url, icon_url_string) {
  const origin_url = new URL(this.url.origin);

  if(icon_url_string) {
    // If sending a head request yielded a response, associate the urls with the
    // icon in the cache and callback.
    const icon_url = new URL(icon_url_string);
    favicon_add_entry(this.db, this.url, icon_url);
    if(redirect_url && redirect_url.href !== this.url.href) {
      favicon_add_entry(this.db, redirect_url, icon_url);
    }
    if(is_origin_diff(this.url, redirect_url, origin_url)) {
      favicon_add_entry(this.db, origin_url, icon_url);
    }

    lookup_favicon_oncomplete.call(this, icon_url);
  } else {
    // We failed to find anything. Ensure there is nothing in the cache.
    favicon_delete_entry(this.db, this.url);
    if(redirect_url && redirect_url.href !== this.url.href) {
      favicon_delete_entry(this.db, redirect_url);
    }

    if(is_origin_diff(this.url, redirect_url, origin_url)) {
      favicon_delete_entry(this.db, origin_url);
    }

    lookup_favicon_oncomplete.call(this);
  }
}

function lookup_favicon_oncomplete(icon_url_object) {
  if(this.db) {
    this.db.close();
  }

  this.callback(icon_url_object);
}

const SELECTORS = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

function search_document(document, base_url) {
  console.assert(document);
  if(document.documentElement.localName !== 'html' || !document.head) {
    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?

  for(let selector of SELECTORS) {
    const icon_url = match_selector(document, selector, base_url);
    if(icon_url) {
      return icon_url;
    }
  }
}

// Look for a specific favicon in the contents of a document
// In addition to being idiomatic, this localizes the try/catch scope so as
// to avoid a larger deopt.
function match_selector(root_element, selector, base_url) {
  const element = root_element.querySelector(selector);
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
    return new URL(href, base_url);
  } catch(error) {
    console.debug(error);
  }
}

// Note that redirect_url may be undefined
function is_origin_diff(page_url, redirect_url, origin_url) {
  return origin_url.href !== page_url.href &&
    (!redirect_url || redirect_url.href !== origin_url.href);
}

function send_image_head_request(img_url, callback) {
  console.debug('HEAD', img_url.href);
  const request = new XMLHttpRequest();
  const async_flag = true;
  const on_response = on_request_image_head.bind(request, img_url, callback);
  request.timeout = 1000;
  request.ontimeout = on_response;
  request.onerror = on_response;
  request.onabort = on_response;
  request.onload = on_response;
  request.open('HEAD', img_url.href, async_flag);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
}

function on_request_image_head(img_url, callback, event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const content_length = get_content_length(response);
  if(!is_content_length_in_range(content_length)) {
    callback();
    return;
  }

  const content_type = response.getResponseHeader('Content-Type');
  if(!is_image_mime_type(content_type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
}

const MIN_CONTENT_LEN = 49;
const MAX_CONTENT_LEN = 10001;

function is_content_length_in_range(len_int) {
  return len_int > MIN_CONTENT_LEN && len_int < MAX_CONTENT_LEN;
}

function get_content_length(response) {
  const len_str = response.getResponseHeader('Content-Length');
  let len_int = 0;
  if(len_str) {
    try {
      len_int = parseInt(len_str, 10);
    } catch(error) {
    }
  }

  return len_int;
}

function is_image_mime_type(type) {
  return type && /^\s*image\//i.test(type);
}

this.lookup_favicon = lookup_favicon;
this.is_favicon_entry_expired = is_entry_expired;
} // End file block scope
