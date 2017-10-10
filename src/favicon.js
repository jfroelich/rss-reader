// Favicon lib

'use strict';

// Requires
// html-parse.js

// TODO: deprecate IIFE (again)


(function(exports) {


// 30 days in ms, used by both lookup and compact
const default_max_age_ms = 1000 * 60 * 60 * 24 * 30;

const IMG_SIZE_UNKNOWN = -1;

// Looks up the favicon url for a given web page url
// @returns {String} the favicon url if found, otherwise undefined
async function lookup(conn, url_object, max_age_ms,
  fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size, max_img_size) {
  DEBUG('Starting lookup for url', url_object.href);
  if(typeof max_age_ms === 'undefined')
    max_age_ms = default_max_age_ms;
  if(typeof fetch_html_timeout_ms === 'undefined')
    fetch_html_timeout_ms = 1000;
  if(typeof fetch_img_timeout_ms === 'undefined')
    fetch_img_timeout_ms = 200;
  if(typeof min_img_size === 'undefined')
    min_img_size = 50;
  if(typeof max_img_size === 'undefined')
    max_img_size = 10240;

  // TODO: maybe this is always overkill and not needed
  const urls = new Set();
  urls.add(url_object.href);

  // Step 1: check the cache for the input url
  if(conn) {
    const icon_url_string = await db_find_lookup_url(conn, url_object,
      max_age_ms);
    if(icon_url_string)
      return icon_url_string;
  }

  const response = await fetch_doc_silently(url_object, fetch_html_timeout_ms);
  if(response) {
    // Step 2: check the cache for the redirect url
    if(conn && response.redirected) {
      const response_url_object = new URL(response.response_url_string);
      urls.add(response_url_object.href);
      const icon_url_string = await db_find_redirect_url(conn, url_object,
        response, max_age_ms);
      if(icon_url_string)
        return icon_url_string;
    }

    // Step 3: check the fetched document for a <link> tag
    const icon_url_string = await search_document(conn, url_object, urls,
      response);
    if(icon_url_string)
      return icon_url_string;
  }

  // Step 4: check the cache for the origin url
  if(conn && !urls.has(url_object.origin)) {
    const icon_url_string = await db_find_origin_url(conn, url_object.origin,
      urls, max_age_ms);
    if(icon_url_string)
      return icon_url_string;
  }

  // Step 5: check for /favicon.ico
  const icon_url_string = await lookup_origin(conn, url_object, urls,
    fetch_img_timeout_ms, min_img_size, max_img_size);
  return icon_url_string;
}

async function db_find_lookup_url(conn, url_object, max_age_ms) {
  const entry = await db_find_entry(conn, url_object);
  if(!entry)
    return;
  const current_date = new Date();
  if(is_entry_expired(entry, current_date, max_age_ms))
    return;
  DEBUG('Found favicon of input url in cache', entry);
  return entry.iconURLString;
}

async function db_find_redirect_url(conn, url_object, response, max_age_ms) {
  const response_url_object = new URL(response.response_url_string);
  const entry = await db_find_entry(conn, response_url_object);
  if(!entry)
    return;
  const current_date = new Date();
  if(is_entry_expired(entry, current_date, max_age_ms))
    return;
  DEBUG('Found redirect in cache', entry);
  const entries = [url_object.href];
  await db_put_entries(conn, entry.iconURLString, entries);
  return entry.iconURLString;
}

// @returns {String} a favicon url
async function search_document(conn, url_object, urls, response) {
  let text;
  try {
    text = await response.text();
  } catch(error) {
    DEBUG(error);
    return;
  }

  const [status, document] = html_parse_from_string(text);
  if(status !== STATUS_OK)
    return;

  if(!document.head)
    return;

  const base_url_object = response.redirected ?
    new URL(response.response_url_string) : url_object;

  let icon_url_object;
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

  for(let selector of selectors) {
    const element = document.head.querySelector(selector);
    if(!element)
      continue;
    // Avoid passing empty string to URL constructor
    let hrefString = element.getAttribute('href');
    if(!hrefString)
      continue;
    hrefString = hrefString.trim();
    if(!hrefString)
      continue;
    try {
      icon_url_object = new URL(hrefString, base_url_object);
    } catch(error) {
      continue;
    }
    DEBUG('Found favicon from <link>', response.response_url_string,
      icon_url_object.href);
    if(conn)
      await db_put_entries(conn, icon_url_object.href, urls);
    return icon_url_object.href;
  }
}

async function db_find_origin_url(conn, origin_url_string, urls, max_age_ms) {
  const origin_url_object = new URL(origin_url_string);
  const origin_entry = await db_find_entry(conn, origin_url_object);
  const current_date = new Date();
  if(!origin_entry)
    return;
  if(is_entry_expired(origin_entry, current_date, max_age_ms))
    return;
  DEBUG('Found non-expired origin entry in cache', origin_url_string,
    origin_entry.iconURLString);
  // origin is not in urls, and we know it is distinct, existing, and fresh
  await db_put_entries(conn, origin_entry.iconURLString, urls);
  return origin_entry.iconURLString;
}

async function lookup_origin(conn, url_object, urls, fetch_img_timeout_ms,
  min_img_size, max_img_size) {
  const img_url_string = url_object.origin + '/favicon.ico';
  const fetch_promise = fetch_image_head(img_url_string,
    fetch_img_timeout_ms);
  let response;
  try {
    response = await fetch_promise;
  } catch(error) {
    DEBUG(error);
    return;
  }

  if(response.size === IMG_SIZE_UNKNOWN || (response.size >= min_img_size &&
      response.size <= max_img_size)) {
    if(conn)
      await db_put_entries(conn, response.response_url_string, urls);
    DEBUG('Found origin icon', url_object.href,
      response.response_url_string);
    return response.response_url_string;
  }
}

async function fetch_doc_silently(url_object, fetch_html_timeout_ms) {
  const fetch_promise = fetch_doc(url_object.href, fetch_html_timeout_ms);
  try {
    return await fetch_promise;
  } catch(error) {
    DEBUG(error);
  }
}

// TODO: rename to something like db_setup
// TODO: use local variable, not favicon.open
async function setup(name, version) {
  // TODO: timeout_ms should be param
  let conn, timeout_ms;
  try {
    conn = await favicon.open(name, version, timeout_ms);
  } finally {
    if(conn)
      conn.close();
  }
}

// TODO: rename to something like db_open
// @param name {String} optional, indexedDB database name
// @param version {Number} optional, indexedDB database version
// @param timeout_ms {Number} optional, maximum amount of time to wait when
// connecting to indexedDB before failure
// @throws {TypeError} invalid timeout (any other errors occur within promise)
// @returns {Promise} resolves to open IDBDatabase instance
async function open(name, version, timeout_ms) {
  if(typeof name === 'undefined')
    name = 'favicon-cache';
  if(typeof version === 'undefined')
    version = 2;
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 100;

  // In the case of a connection blocked event, eventually timeout
  const connect_promise = create_open_promise(name, version);
  const error_message = 'Connecting to indexedDB database ' + name +
    ' timed out.';
  const timeout_promise = reject_after_timeout(timeout_ms, error_message);
  const promises = [connect_promise, timeout_promise];
  return await Promise.race(promises);
}

// TODO: improve this function name to clarify it is related to db
function create_open_promise(name, version) {
  return new Promise(function(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon_db_upgrade;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
}

// TODO: simplify this function name?
function favicon_db_upgrade(event) {
  const conn = event.target.result;
  DEBUG('creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    DEBUG('Creating favicon-cache object store');
    store = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    DEBUG('Creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }
}

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
// TODO: maybe new Date() is not much of an optimization so current_date does
// not need to be a param and instead create it locally per call
function is_entry_expired(entry, current_date, max_age_ms) {
  // Subtracting a date from another date yields a difference in ms
  const entry_age_ms = current_date - entry.dateUpdated;
  return entry_age_ms > max_age_ms;
}

function clear(conn) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: should probably delete this, cannot recall why it is here
async function find_unexpired_entry(conn, url_object, max_age_ms) {
  ASSERT(false, 'not implemented');
}

function db_find_entry(conn, url_object) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(url_object.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function db_find_expired_entries(conn, max_age_ms) {
  return new Promise(function(resolve, reject) {
    let cutoff_time_ms = Date.now() - max_age_ms;
    cutoff_time_ms = cutoff_time_ms < 0 ? 0 : cutoff_time_ms;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const cutoff_time_date = new Date(cutoff_time_ms);
    const range = IDBKeyRange.upperBound(cutoff_time_date);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });
}

function db_remove_entries_with_urls(conn, page_urls) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of page_urls)
      store.delete(url);
  });
}

function db_put_entries(conn, icon_url_string, page_urls) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    const current_date = new Date();
    for(const url_string of page_urls) {
      const entry = {};
      entry.pageURLString = url_string;
      entry.iconURLString = icon_url_string;
      entry.dateUpdated = current_date;
      store.put(entry);
    }
  });
}

// Finds all expired entries in the database and removes them
async function compact(name, version, max_age_ms) {
  if(typeof max_age_ms === 'undefined')
    max_age_ms = default_max_age_ms;

  let conn_timeout_ms, conn, resolutions;

  try {

    conn = await open(name, version, conn_timeout_ms);
    const expired_entries = await db_find_expired_entries(conn, max_age_ms);
    const urls = [];
    for(const entry of expired_entries)
      urls.push(entry.pageURLString);

    resolutions = await db_remove_entries_with_urls(conn, urls);

  } finally {
    if(conn)
      conn.close();
  }

  return resolutions.length;
}

function reject_after_timeout(timeout_ms, error_message) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 4;
  // Per MDN and Google, the minimum is 4ms.
  ASSERT(timeout_ms > 3);

  return new Promise(function(resolve, reject) {
    const error = new Error(error_message);
    setTimeout(reject, timeout_ms, error);
  });
}

// TODO: this functionality belongs in a separate module
// Race a timeout against a fetch
// TODO: cancel fetch once cancelation tokens supported
async function fetch_with_timeout(url_string, options, timeout_ms) {
  ASSERT(typeof url_string === 'string');

  // TODO: this should not be an error, this should be some type of early
  // return.
  if('onLine' in navigator && !navigator.onLine)
    throw new Error('offline');

  const fetch_promise = fetch(url_string, options);
  let response;
  if(timeout_ms) {
    const error_message = 'Request timed out for url ' + url_string;
    const timeout_promise = reject_after_timeout(timeout_ms, error_message);
    const promises = [fetch_promise, timeout_promise];
    response = await Promise.race(promises);
  } else {
    response = await fetch_promise;
  }

  // TODO: this should not be an exception, this should be some type of
  // early return
  // TODO: this is insecure, never use user-supplied values in a template
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url_string}`);
  return response;
}

// TODO: this functionality belongs in a separate module
async function fetch_doc(url_string, timeout_ms) {
  const headers = {'Accept': 'text/html'};
  const options = {};
  options.credentials = 'omit';
  options.method = 'get';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';
  options.referrerPolicy = 'no-referrer';
  const response = await fetch_with_timeout(url_string, options, timeout_ms);


  // TODO: this should not throw because not invariant.
  ASSERT(response_has_content);

  // TODO: this should not throw because this is not an invariant. Instead
  // should return undefined?
  ASSERT(response_is_type_html);

  const output_response = {};
  output_response.text = async function() {
    return await response.text();
  };
  output_response.response_url_string = response.url;
  output_response.redirected = detect_redirect(url_string, response.url);
  return output_response;
}

function detect_redirect(request_url_string, response_url_string) {
  // A redirected url is never the same as the request url. Regardless of
  // what happens in the underlying opaque request, or whatever
  // Response.prototype.redirected is
  if(request_url_string === response_url_string)
    return false;
  const request_url_object = new URL(request_url_string);
  const response_url_object = new URL(response_url_string);
  request_url_object.hash = '';
  response_url_object.hash = '';
  return request_url_object.href !== response_url_object.href;
}

// TODO: this functionality probably belongs in a separate module
// Sends a HEAD request for the given image.
// @param url_string {String}
// @returns a simple object with props imageSize and response_url_string
async function fetch_image_head(url_string, timeout_ms) {
  const headers = {'Accept': 'image/*'};
  const options = {};
  options.credentials = 'omit';
  options.method = 'HEAD';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';
  const response = await fetch_with_timeout(url_string, options, timeout_ms);

  // TODO: this should not throw, because this is not a test of an invariant.
  // Instead the function should return null in this case or something along
  // those lines.
  ASSERT(response_is_type_image);

  const output_response = {};
  output_response.size = response_get_content_length(response);
  output_response.response_url_string = response.url;
  return output_response;
}

// TODO: move to response.js in fetch or net folder
function response_get_content_length(response) {
  const content_length_string = response.headers.get('Content-Length');
  const radix = 10;
  const content_length = parseInt(content_length_string, radix);
  return isNaN(content_length) ? IMG_SIZE_UNKNOWN : content_length;
}

function response_has_content(response) {
  const HTTP_STATUS_NO_CONTENT = 204;
  return response.status !== HTTP_STATUS_NO_CONTENT;
}

function response_is_type_html(response) {
  return /^\s*text\/html/i.test(response.headers.get('Content-Type'));
}

function response_is_type_image(response) {
  return /^\s*image\//i.test(response.headers.get('Content-Type'));
}

exports.favicon = {
  'lookup': lookup,
  'open': open,
  'clear': clear,
  'compact': compact,
  'setup': setup
};

}(this));


/*

# About

The problem this library tries to solve is to provide a simple means of getting
the url of the favicon associated with a given page url. At the time of writing
this library there was no simple browser-oriented-js solution available, and
Chrome appeared to be restricting access to its internal favicon cache.

The primary public function is `favicon.lookup`. lookup accepts a page url and
returns a favicon url. The function tries to conform to the spec, which sadly is
not extremely well documented, and has some inefficiency. Ignoring the cache
lookups, the algorithm involves the following steps:

1. Fetch the URL.
2. Search the contents of the URL for a <link> specifying the icon.
3. If no icon is found, check for '/favicon.ico' in the document root.

The spec talks about how to choose the most appropriate icon when multiple icons
are specified, based on size and other properties. I chose not to bother with
choosing the best, just finding any of them.

The lookup algorithm always checks the URL first, before checking for the
favicon.ico file in the domain's root path, because my understanding of
favicons is that individual pages of a website are allowed to specify an icon
that is unique to the page, and not site wide. Icons in the root are site
wide. Most sites in fact use the site wide icon. But because each page can be
different, I must always check the page, and this cannot be avoided.

In addition to lookup, there are two other key functions, connect and compact.

* `favicon.open` opens a connection to indexedDB. The connection
is the first parameter to the lookup function. indexedDB is used to provide a
simple caching mechanism for the lookup, that memoizes certain lookups.
* `favicon.compact` function is a housekeeping function intended to run
periodically. It examines the cache for older entries and removes them.

# Why this uses a separate database from the app

This uses a separate database in order to remain independent of the app. The
benefit of independence outweighs the cost of having to maintain separate
connections.

There may be an issue with some platforms not allowing for multiple, concurrent
connections. I think on iOS. But I am not too concerned.

# About "Refused to load the script" errors

Occasionally I see the following messages appear in the console: Refused to
load the script 'url' because it violates the following Content Security Policy
directive: "script-src 'self'". The code internally calls fetch. fetch
internally uses the Content Security Policy defined in the extension's
manifest. This app's manifest provides: "content_security_policy":
"... script-src 'self' ...". In the response headers I see the following:
link:<path-to-script>; rel=preload; as=script.  The reason that the warning
appears is because the script is pushed. To avoid this error I have to figure
out how to signal that I have no interest at all in HTTP/2. For push help see
section 3.3. of https://w3c.github.io/preload/, and also https://tools.ietf.org/html/rfc5988#section-5.

I do not currently know how to signal no interest in push. For now I must deal
with wasted resources and strange console messages. I asked stackoverflow: https://stackoverflow.com/questions/45352300

Side note on disabling OPTIONS: https://stackoverflow.com/questions/29954037
- maybe my setting of Accept is causing an issue?

# General todo items

* Reintroduce parameter that is the fetched document, optional. When the doc
is specified, do not fetch the document. One of the big problems with polling
right now is that I am seeing duplicate requests. Even though each second
request might be cached, I'd rather just not even do it.

* Spend more time thinking about the similarity of findLookupURLInCache,
findRedirectInCache, and findOriginInCache. The similarity suggests
I should be using a single function.
* Implement findUnexpiredEntry, then look at where I call findEntry and
replace it
* Revisit whether favicons are now supported from within a chrome
extension. At least document very clearly why this library has to be used
in the alternative. It may no longer need to exist. This time around, take
better notes as to why I can or cannot use chrome internals.
* when checking image mime type, consider being more restrictive about allowed
content type: image/vnd.microsoft.icon, image/png, image/x-icon,
image/webp
* Should findIconInDocument use querySelectorAll?
* For compact, check if indexedDB now supports a range for delete, and see if
there is a simple way of deleting expired entries that does not involve
object deserialization.
* Look into why I see this log message repeatedly: Fetch finished loading: HEAD "https://github.com/favicon.ico". I should not be seeing this so frequently if
lookups are cached. I am not sure what is going on. It should be present in the
cache and not expired which means the initial cache lookup near the start of
the lookup function should find it, which means no fetching should occur at
all. Well, it is happening for specific pages on github, which then default to
the origin, but it seems like either the origin url is then not properly
searched for in the cache, or is not properly added to the cache, or is somehow
being inadvertently removed from the cache. Side note I may have resolved the
error after recent changes.
* Look for more opportunities for concurrency. Cache lookups can happen
concurrently with fetches?
* Spend some more time thinking about abstraction. I think I want to do more
to abstract away the use of indexedDB. Like, maybe favicon.lookup should accept
dbName/dbVersion params, and a dbConn param, and if dbConn not set, then
connect on demand, or something to this effect. That conflicts with logic of
cacheless lookup at the moment. There are my own use cases, one where i do not
reuse the open conn across calls and one where i do. but if this library were
ever used in other contexts, maybe there is no need for it. Also, maybe it is
worth using an option like FaviconCache that abstracts away indexedDB itself.
Not because I want to allow for swapping in other cache mechanisms. But because
I don't want the caller to be concerned with how indexedDB works. But maybe
this is over abstraction, and exposing indexedDB is a good thing?
* Validate icons found from links in a similar manner to how the origin root
icon is validated (using head, size, etc)
* what if i stored 'expiresDate' property in entry instead of dateUpdated
property? Keep in mind servers respond sometimes with an expires header. This
seems better and probably more in line with other systems, the db would be
more like other cache implementations this way, i am not making up my own
custom expires date and instead trying to use whatever the remote server
suggests, so it is more respectful

# TODO: Better document fetching

Use the new streaming api when sending a request to get a doc. Use together
with TextDecoder. Stream until &lt;head is found. Then cancel the response. Then
recreate a full html string (append >&lt;/html&gt;), then parse that for link
tags.

This avoids the need to download the whole document. I do not think accuracy
decreases too much (e.g. fake </head> in a js comment or something is rare).

Maybe I can avoid parsing and just search raw text for link tags, the accuracy
loss may be ok given the speed boost

Research notes on streaming fetch responses:
* https://jsbin.com/vuqasa/edit?js,console
* https://jakearchibald.com/2016/streams-ftw/
* https://jsbin.com/gameboy/edit?js,console
* https://github.com/whatwg/fetch/issues/447

# TODO: Reduce favicon cache size

Caching by page url could lead to a huge cache. Maybe I should only be caching origins or domains or hostnames and never cache individual pages.

think this should depart from the spec. Or maybe make it an option on whether to be compliant, or even have two functions one that is compliant and one that is not.

The proposed algorithm:

The lookup function should take an optional document object that contains the html of the lookup url
If the document is provided, search it. If found icon, store in cache and return icon.
If the document has not been fetched, do not fetch it.
Get the origin of the url
Check if the origin is cached and if so return that
If the origin is not cached, lookup the root icon.
If a root icon is found, store an entry linking the origin url to the root icon url, then return the icon url.
If a root icon is not found, return null.
This would avoid the need to perform a fetch of the document in many cases. For example, when there are several urls per origin, which is quite often given that a website's feed generally points to articles from that website. But also in the case of meta feeds like Google news, it points to articles from the same site several times.

I am concerned right now that the double request isn't respecting the cache, even though I would assume the requests are coalesced. This is something to also look into.

The net result would be less network overhead per lookup, and a significantly reduced cache size. There would be some inaccuracy when a single page's custom favicon differs from the origin's favicon, but I think for the purposes of this app that is fine. The generality of the favicon module should favor its purpose in this app over being accurate and spec compliant across all projects.

# TODO: Check reachability of in page favicons

If i find favicon in page, I currently do not send a HEAD request for it, and this leads to not actually finding the url. This means I have to actually ping in page urls and check if they are valid. Which means I think that find in page icon url function needs to also be async.

I might also need to use Promise.all or Promise.race, to more easily fallback to other possible candidate link elements.

# TODO: Improve favicon lookup failure behavior

Problem with not finding favicons. If there is no favicon for page or its redirect url or its domain, I still keep sending out HEAD requests every single time, indefinitely. This is horrible. I need a way to prevent future requests for some period of time, so that such requests auto fail without any network activity for some period of time.

What about storing a request failure count per icon or something to that effect. Then when failing to fetch, updating the request failure count. Then if count reaches 10 or something, then delete or store a permanently unreachable flagged entry. This would tolerate being temporarily unreachable better?

# Think about revealing API surface pattern

Similar to how you do something like:

  const server = createServer(...);
  server.doStuff();

I could do something like:

  const fi_service = open_fi_service();
  fi_service.lookup();
  fi_service.compact();
  fi_service.close();

Then, the only global exported is open_fi_service.

I kind of like it.

* I tied into how lookup, compact and close are dependent on open.
* It minimizes globals
* It is consistent with how other APIs approach things, it has been done before
* It restricts access to functionality correctly, e.g. cannot call compact
before open ...
* It encapsulates indexedDB. The returned object has an api that wraps calls
so there is no need to pass around the instance of IDBDatabase, or expose it
in any way. It does not even need to be a parameter to later function calls
because it becomes part of the internal state.
* On the other hand it demands indexedB? I dunno maybe all the other functions
can check if conn is present and react accordingly.

# TODO: think about storing lookup failures in cache

Store failure cases too, that way i stop trying to refetch the same thing repeatedly, use something like failure counter, once it reaches 10 then delete, something like that.

Modify other checks to consider if matched failure case. If successful make sure to delete failure cases.

This also fixes ephemeral errors (site temp offline, temp unreachable).

# todo items copied from test file


* Use a test db instead of the real db, and make sure to
delete the test db at the end of the test.
* actually run tests instead of command line
* test offline
* test a non-existent host
* test a known host with origin /favicon.ico
* test a known host with <link> favicon
* test a non-expired cached input url
* test a non-expired cached redirect url
* test a non-expired cached origin url
* same as above 3 but expired
* test against icon with byte size out of bounds
* test cacheless versus caching?
* test compact

*/
