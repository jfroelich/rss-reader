'use strict';

// import fetch.js
// import html-parser.js
// import rbl.js
// import url.js

// TODO: just checking if cache is defined is not sufficient, need to check if conn is defined
// TODO: use a queue or somehow join a request queue that merges lookups to the same origin
// TODO: cleanup debug messages after testing

class FaviconLookup {
  constructor() {
    // After 2 lookups stop trying (comparison is <=)
    this.MAX_ORIGIN_FAILURE_COUNT = 2;

    this.cache = undefined;

    // If true, lookup will skip the fetch of the input url
    this.skipURLFetch = false;

    // These all store numbers

    // Default to the constant defined in FaviconCache
    this.maxAgeMs = FaviconCache.MAX_AGE_MS;

    this.fetchHTMLTimeoutMs = 4000;
    this.fetchImageTimeoutMs = 200;

    // TODO: move defaults to here
    this.minImageSize = 50;
    this.maxImageSize = 10240;

  }
}

// @param document {Document}
// @param baseURL {URL} the base url of the document for resolution purposes
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
  // TODO: note that during refactor I changed this to an array
  const urls = [];
  urls.push(url.href);

  // If the cache is available, first check if the input url is cached
  if(this.cache) {
    const entry = await this.cache.findEntry(url);
    const currentDate = new Date();
    if(entry && entry.iconURLString && !this.isExpired(entry, currentDate, this.maxAgeMs)) {
      // TEMP: for debug refactor, will delete
      console.debug('found lookup url in cache', url.href, entry.iconURLString);
      return entry.iconURLString;
    }
  }

  // If a pre-fetched document was given then search it
  if(document) {
    // TEMP for refactor debug, will delete
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

  // Check if we reached the max failure count for requests to the origin
  // TODO: this should probably somehow expire to allow eventual success, probably by checking
  // if entry expired, but based on expires date set in entry instead of externally, so that I can
  // have different expiration dates for cache items.
  if(this.cache) {
    const originURL = new URL(url.origin);
    const entry = await this.cache.findEntry(originURL);
    if(entry && entry.failureCount >= this.MAX_ORIGIN_FAILURE_COUNT) {
      // TEMP: for debugging refactor, will delete
      console.debug('canceled lookup because too many failures', url.href);
      return;
    }
  }

  // Fetch the url's response. Failure is not fatal to lookup.
  let response;
  if(!document && !this.skipURLFetch) {
    try {
      response = await fetchHTML(url.href, this.fetchHTMLTimeoutMs);
    } catch(error) {
      if(isUncheckedError(error)) {
        throw error;
      } else {
        // ignore
        // TEMP: for debugging refactor, will delete
        console.debug('failed to fetch', url.href, error);
      }
    }
  }

  // Check if the response redirected and is in the cache
  let responseURL;
  if(response) {
    if(response.redirected) {
      responseURL = new URL(response.responseURL);

      // Only append if distinct from input url. We only 'redirected' if 'distinct'.
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

  // Parse the response into an HTML document
  let didParse = false;
  if(response) {
    let text;
    try {
      text = await response.text();
    } catch(error) {
      // ignore. parse error not fatal to lookup
      // TEMP: debug for refactor
      console.debug('error parsing response', url.href, error);
    }

    if(text) {
      try {
        document = HTMLParser.parseDocumentFromString(text);
        didParse = true;
      } catch(error) {
        if(isUncheckedError(error)) {
          throw error;
        } else {
          // ignore. parse error is not fatal to lookup
          // TEMP: for debug refactor, will delete
          console.debug('error parsing response', url.href, error);
        }
      }
    }
  }

  // If we successfully parsed the fetched document, search it
  if(didParse) {
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

  const originURL = new URL(url.origin);

  // Check the cache for the origin url if it is distinct from other urls already checked
  if(this.cache && !urls.includes(originURL.href)) {
    const entry = await this.cache.findEntry(originURL);

    if(entry) {
      const iconURL = entry.iconURLString;
      const currentDate = new Date();
      if(!this.isExpired(entry, currentDate, this.maxAgeMs)) {

        // TEMP: for debug refactor, will delete
        console.debug('found fresh origin in cache', originURL.href, iconURL);

        // Store the icon for the other urls (we did not add origin to urls array)
        await this.cache.putAll(urls, iconURL);
        return iconURL;
      }

      if(entry.failureCount >= this.MAX_ORIGIN_FAILURE_COUNT) {
        // Issue #453.
        // TODO: this may be redundant with earlier check?
        // TEMP: debug for refactor
        console.debug('canceling lookup, reached max failure count', originURL.href);
        return;
      }
    }


  }

  // Now append origin to urls list in prep for next step
  if(!urls.includes(originURL.href)) {
    urls.push(originURL.href);
  }


  // Check for favicon in the origin root directory
  const imageURL = url.origin + '/favicon.ico';
  response = null;

  try {
    response = await fetchImageHead(imageURL, this.fetchImageTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Issue #453
      // If the fetch failed, store a failure entry
      if(this.cache) {
        // NOTE: this is now a URL object
        await this.onOriginFetchFailure(originURL);
      }

      // Exit lookup with nothing, lookup failed (not due to an error)
      console.debug('lookup failed (without error)', url.href);
      return;
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

  // Failure (all JavaScript functions implictly return undefined)
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

// Issue #453
// TODO: if this search was done previously by the caller it would make sense to avoid the
// additional lookup, perhaps with an entry parameter to this function. I am concerned there are
// too many database round trips and want to minimize the number.
FaviconLookup.prototype.onOriginFetchFailure = async function(originURL) {
  const entry = await this.cache.findEntry(originURL);
  if(entry) {
    const newEntry = {};
    newEntry.pageURLString = entry.pageURLString;
    newEntry.dateUpdated = new Date();
    newEntry.iconURLString = entry.iconURLString;
    if('failureCount' in entry) {
      if(entry.failureCount <= FaviconLookup.MAX_ORIGIN_FAILURE_COUNT) {
        // TEMP: debug for the refactor
        console.debug('storing incremented failure count of origin fetch', newEntry.pageURLString);
        newEntry.failureCount = entry.failureCount + 1;
        await this.cache.put(newEntry);
      } else {
        // noop if max failure count exceeded
      }
    } else {
      console.debug('storing initial failure of origin fetch', newEntry.pageURLString);
      newEntry.failureCount = 1;
      await this.cache.put(newEntry);
    }
  } else {
    // TEMP: debug for refactor
    console.debug('storing failed entry with page url', originURL.href);
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    await this.cache.put(newEntry);
  }
};
