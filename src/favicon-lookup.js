'use strict';

// import favicon-cache.js
// import fetch.js
// import html-parser.js
// import rbl.js
// import url.js

// TODO: the failure guards should eventually let the request succeed somehow. Probably failure
// entries should also have an expiration period.
// TODO: this should probably somehow expire to allow eventual success, probably by checking
// if entry expired, but based on expires date set in entry instead of externally, so that I can
// have different expiration dates for non-failure cache items and failure cache items.

// TODO: when determining whether to perform a cacheless lookup, just checking if cache is defined
// is not sufficient, this needs to also check if conn is defined, the caller may wire up a cache
// instance but never call cache.connect()
// TODO: use a queue or somehow join a request queue that merges lookups to the same origin
// TODO: cleanup debug messages after testing
// TODO: cleanup origin url initialization, it is done redundantly in a couple spots

class FaviconLookup {
  constructor() {
    this.cache = undefined;
    this.kMaxFailureCount = 2;// (comparison is <=), 'const'
    this.skipURLFetch = false;
    this.maxAgeMs = FaviconCache.MAX_AGE_MS;
    this.fetchHTMLTimeoutMs = 4000;
    this.fetchImageTimeoutMs = 1000;
    this.minImageSize = 50;
    this.maxImageSize = 10240;
  }
}

// @param document {Document}
// @param baseURL {URL} the base url of the document for resolution purposes
// @throws {AssertionError}
// @returns {String} favicon url if found
FaviconLookup.prototype.search = function(document, baseURL) {
  assert(document instanceof Document);
  assert(baseURL instanceof URL);

  // Search is restricted to head element descendants
  if(!document.head) {
    return;
  }

  // TODO: querySelectorAll on one selector instead?
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

  for(const selector of selectors) {
    const element = document.head.querySelector(selector);
    if(element) {
      let hrefValue = element.getAttribute('href');

      // href values may be relative, so resolve the url before returning.

      // NOTE: do not pass an 'empty' url to the URL constructor when base url is also defined
      // as base url will become the resulting url. This was previously the source of a bug.
      if(typeof hrefValue === 'undefined') {
        hrefValue = '';
      }
      hrefValue = hrefValue.trim();
      if(hrefValue) {
        try {
          const iconURL = new URL(hrefValue, baseURL);
          return iconURL.href;
        } catch(error) {
          // ignore
        }
      }
    }
  }
};

// Looks up the favicon url for a given web page url
// @param url {URL} the lookup url
// @param document {Document} optional pre-fetched document for the url
// @returns {String} the associated favicon url or undefined
FaviconLookup.prototype.lookup = async function(url, document) {
  assert(url instanceof URL);
  if(typeof document !== 'undefined') {
    assert(document instanceof Document);
  }

  console.debug('lookup', url.href);

  // Store a distinct set of request urls involved in the lookup so that various conditions are
  // simpler to implement and read
  const urls = [];
  urls.push(url.href);

  // If the cache is available, first check if the input url is cached
  if(this.cache) {
    const entry = await this.cache.findEntry(url);
    const currentDate = new Date();

    if(entry) {
      // If we found a valid cached entry then exit early with the icon url
      if(entry.iconURLString && !this.isExpired(entry, currentDate, this.maxAgeMs)) {
        // TEMP: for debug refactor, will delete
        console.debug('found lookup url in cache', url.href, entry.iconURLString);
        return entry.iconURLString;
      }

      // If the entry's origin is the same as the url, and the entry failure count exceeds the
      // max failure count, then exit early without a result.
      const originURL = new URL(url.origin);
      if(originURL.href === url.href) {
        if(entry.failureCount >= this.kMaxFailureCount) {
          console.debug('canceling lookup, too many failures on origin (origin same as input)',
            originURL.href);
          return;
        }
      }
    }
  }

  // If a pre-fetched document was given then search it
  if(document) {
    console.debug('lookup has pre-fetched document', url.href);
    const iconURL = this.search(document, url);
    if(iconURL) {
      console.debug('found icon in pre-fetched document', url.href, iconURL);
      if(this.cache) {
        await this.cache.putAll(urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if we reached the max failure count for requests to the origin, if the origin is
  // different than the input url

  // This is outside the scope of the if blocks here so that it can be re-used at the end of the
  // function in the case of failure.
  let originEntry;

  if(this.cache) {
    const originURL = new URL(url.origin);

    if(originURL.href !== url.href) {
      originEntry = await this.cache.findEntry(originURL);
      if(originEntry && originEntry.failureCount >= this.kMaxFailureCount) {
        // TEMP: for debugging refactor, will delete
        console.debug('canceled lookup because too many failures', url.href);
        return;
      } else {
        // TEMP: for debugging, will delete
        console.debug('Origin url not found in pre-fetch guard, or found but failure count under threshold',
          originURL.href, originEntry);
      }
    } else {
      // TEMP: for debugging, will delete
      console.debug('skipping origin failure count guard, origin same as input url');
    }
  }

  // Fetch the url's response. Failure is not fatal to lookup.
  let response;
  if(!document && !this.skipURLFetch) {
    response = await this.fetchHTML(url.href);
  }

  // Check if the response redirected and is in the cache
  let responseURL;
  if(response) {
    if(response.redirected) {
      responseURL = new URL(response.responseURL);

      // Only append if distinct from input url. We only 'redirected' if 'distinct'
      urls.push(responseURL.href);

      if(this.cache) {
        const entry = await this.cache.findEntry(responseURL);
        if(entry) {
          const currentDate = new Date();
          if(entry.iconURLString && !this.isExpired(entry, currentDate, this.maxAgeMs)) {
            // TEMP: debug for refactor, will delete
            console.debug('found redirect in cache', responseURL.href);
            await this.cache.putAll(urls, entry.iconURLString);
            return entry.iconURLString;
          }
        }
      }
    }
  }

  // Nullify document so there is no ambiguity regarding whether fetching/parsing failed and
  // whether an input document was specified. The document parameter variable is re-used.
  document = undefined;
  if(response) {
    document = await this.parseHTMLResponse(response);
  }

  // If we successfully parsed the fetched document, search it
  if(document) {
    const baseURL = responseURL ? responseURL : url;
    const iconURL = this.search(document, baseURL);
    if(iconURL) {
      console.debug('found icon in fetched document', url.href, iconURL);
      if(this.cache) {
        await this.cache.putAll(urls, iconURL);
      }
      return iconURL;
    }
  }

  // Initialize originURL
  let originURL;
  if(responseURL) {
    originURL = new URL(responseURL.origin);
  } else {
    originURL = new URL(url.origin);
  }

  // NOTE: this feels like the source of the bug. the entry.failureCount test happens separately,
  // something about that. Yeah this isn't right. It is related to the last-minute addition of
  // iconURL definedness test in the condition. Somewhere around here is wrong.

  // I am struggling to articulate what should happen. Try enumeration. What are the cases.

  // 1) A normal lookup where we fallback to origin check, and want to return it if in cache
  // 2) A failed lookup, where we fallback to origin check, where we maybe want to return it or
  // something?

  // The issue: when am I supposed to increment count? What are the conditions under which it
  // should be incremented? This is the issue. I am missing one of the cases where it should be
  // incremented but is not. Should this happen before or after trying the favicon root?


  // Check the cache for the origin url if it is distinct from other urls already checked
  if(this.cache && !urls.includes(originURL.href)) {
    const entry = await this.cache.findEntry(originURL);



    if(entry) {
      const iconURL = entry.iconURLString;
      const currentDate = new Date();




      if(iconURL && !this.isExpired(entry, currentDate, this.maxAgeMs)) {

        // TEMP: for debug refactor, will delete
        console.debug('found fresh origin in cache', originURL.href, iconURL);

        // Store the icon for the other urls (we did not add origin to urls array)
        await this.cache.putAll(urls, iconURL);
        return iconURL;
      } else if(entry.failureCount >= this.kMaxFailureCount) {
        // Issue #453.
        // TODO: this may be redundant with earlier check?
        // TEMP: debug for refactor
        console.debug('canceling lookup, reached max failure count', originURL.href);
        return;
      } else {
        console.debug('found origin in cache and failure count less than threshold');
      }
    } else {
      console.debug('did not find origin url in cache');
    }
  } else {
    // TEMP: researching bug
    console.debug('cacheless or origin is unique, not repeating origin cache check or failure count guard');
  }

  // Now append origin to urls list in prep for next step
  if(!urls.includes(originURL.href)) {
    urls.push(originURL.href);
  }


  // Check for favicon in the origin root directory
  const imageURL = url.origin + '/favicon.ico';

  // Set response to null so that if it is previously defined, it will not affect the logic
  // of whether it became redefined after calling fetchImageHead
  response = null;

  try {
    response = await fetchImageHead(imageURL, this.fetchImageTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      console.debug('fetch image head failed', imageURL);
    }
  }

  // If we fetched the image, and the image size is unknown or within bounds, succeed.
  if(response && (response.size === this.FETCH_UNKNOWN_CONTENT_LENGTH ||
    (response.size >= this.minImageSize && response.size <= this.maxImageSize))) {
    const iconURL = response.responseURL;
    if(this.cache) {
      await this.cache.putAll(urls, iconURL);
    }
    return iconURL;
  }

  // Issue #453
  // If everything failed, increment the failure count for the origin
  console.debug('every lookup branch failed, store a failure entry for the origin');

  if(this.cache) {
    await this.onLookupFailure(originURL, originEntry);
  }

};

// Helper that traps non-assertion errors as those are non-fatal to lookup
FaviconLookup.prototype.fetchHTML = async function(url) {
  assert(typeof url === 'string');
  try {
    return await fetchHTML(url, this.fetchHTMLTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore the error
      // TEMP: for debugging refactor, will delete
      console.debug('failed to fetch', url, error);
    }
  }
};

// Helper that traps non-assertion errors
// @param response {Response}
// @throws {AssertionError}
// @returns {Document}
FaviconLookup.prototype.parseHTMLResponse = async function(response) {
  try {
    const text = await response.text();
    return HTMLParser.parseDocumentFromString(text);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // ignore. fetch/parse error is not fatal to lookup
      console.debug('error creating html document from repsonse', url.href, error);
    }
  }
};

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
// TODO: this should not operate on entry, it should operate on entry.dateUpdated as the parameter,
// so that the parameters are narrowly defined
// TODO: maxAgeMs is pretty much always this.maxAgeMs, right? So no need to pass it around
FaviconLookup.prototype.isExpired = function(entry, currentDate, maxAgeMs) {
  const entryAgeMs = currentDate - entry.dateUpdated;
  return entryAgeMs > maxAgeMs;
};

// TODO: this requires too much knowledge of cache entry structure. Probably need to create a
// helper function in cache and just pass known parameters and let it properly assemble the entry.
// Or maybe even this whole thing should be a cache function.

// Issue #453
// @param originURL {URL}
// @param currentEntry {Object} optional, the existing origin entry if the lookup was already
// performed and the entry is available
FaviconLookup.prototype.onLookupFailure = async function(originURL, currentEntry) {
  assert(this.cache);
  assert(isOpenDB(this.cache.conn));

  const entry = currentEntry ? currentEntry : await this.cache.findEntry(originURL);
  if(entry) {
    const newEntry = {};
    newEntry.pageURLString = entry.pageURLString;
    newEntry.dateUpdated = new Date();
    newEntry.iconURLString = entry.iconURLString;
    if('failureCount' in entry) {
      if(entry.failureCount <= this.kMaxFailureCount) {
        console.debug('storing incremented failure count of origin fetch', newEntry.pageURLString);
        newEntry.failureCount = entry.failureCount + 1;
        await this.cache.put(newEntry);
      } else {
        // noop if max failure count exceeded
        console.debug('onLookupFailure noop, failure count already exceeded', entry.failureCount);
      }
    } else {
      console.debug('storing initial failure of origin fetch', newEntry.pageURLString);
      newEntry.failureCount = 1;
      await this.cache.put(newEntry);
    }
  } else {
    console.debug('storing failed entry with page url', originURL.href);
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    await this.cache.put(newEntry);
  }
};
