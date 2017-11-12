'use strict';

// import favicon-cache.js
// import fetch.js
// import html-parser.js
// import rbl.js
// import url.js

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
  if(this.hasCache()) {
    const entry = await this.cache.findEntry(url);
    if(entry) {
      // If we found a fresh entry then exit early with the icon url
      if(entry.iconURLString && !this.isExpired(entry)) {
        return entry.iconURLString;
      }

      // If the entry's origin is the same as the url, and the entry failure count exceeds the
      // max failure count, then exit early without a result.
      const originURL = new URL(url.origin);
      if(originURL.href === url.href && entry.failureCount >= this.kMaxFailureCount) {
        return;
      }
    }
  }

  if(document) {
    const iconURL = this.search(document, url);
    if(iconURL) {
      if(this.hasCache()) {
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
  if(this.hasCache()) {
    const originURL = new URL(url.origin);
    if(originURL.href !== url.href) {
      originEntry = await this.cache.findEntry(originURL);
      if(originEntry && originEntry.failureCount >= this.kMaxFailureCount) {
        return;
      }
    }
  }

  // Fetch the url's response, failure is not fatal
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
      if(this.hasCache()) {
        const entry = await this.cache.findEntry(responseURL);
        if(entry && entry.iconURLString && !this.isExpired(entry)) {
          await this.cache.putAll(urls, entry.iconURLString);
          return entry.iconURLString;
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
      if(this.hasCache()) {
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

  // Check the cache for the origin url if it is distinct from other urls already checked
  if(this.hasCache() && !urls.includes(originURL.href)) {
    const entry = await this.cache.findEntry(originURL);
    if(entry) {
      const iconURL = entry.iconURLString;
      if(iconURL && !this.isExpired(entry)) {
        // Store the icon for the other urls (we did not add origin to urls array)
        await this.cache.putAll(urls, iconURL);
        return iconURL;
      } else if(entry.failureCount >= this.kMaxFailureCount) {
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
  response = await this.fetchImage(imageURL);

  if(this.isAcceptableImageResponse(response)) {
    if(this.hasCache()) {
      await this.cache.putAll(urls, response.responseURL);
    }
    return response.responseURL;
  }

  if(this.hasCache()) {
    await this.onLookupFailure(originURL, originEntry);
  }
};

FaviconLookup.prototype.hasCache = function() {
  return this.cache && isOpenDB(this.cache.conn);
};

// Returns true if response byte size in bounds. Tolerates undefined response.
FaviconLookup.prototype.isAcceptableImageResponse = function(response) {
  return response && (response.size === FETCH_UNKNOWN_CONTENT_LENGTH ||
    (response.size >= this.minImageSize && response.size <= this.maxImageSize))
};

// Helper that traps non-assertion errors because errors not fatal to lookup
FaviconLookup.prototype.fetchImage = async function(url) {
  assert(typeof url === 'string');
  try {
    return await fetchImageHead(url, this.fetchImageTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore
    }
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
      // Ignore
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
      // Ignore
    }
  }
};

// Returns whether a cache entry is expired
FaviconLookup.prototype.isExpired = function(entry) {
  // Expect entries to always have a date set
  assert(entry.dateUpdated instanceof Date);
  // Expect this instance to always have a max age set
  assert(isPosInt(this.maxAgeMs));

  // An entry is expired if the difference between the current date and the date the
  // entry was last updated is greater than max age.
  const currentDate = new Date();
  // The subtraction operator on dates yields a difference in milliseconds
  const entryAgeMs = currentDate - entry.dateUpdated;
  return entryAgeMs > this.maxAgeMs;
};

FaviconLookup.prototype.LINK_SELECTOR = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
].join(',');

// Searches the document for favicon urls
// @param document {Document}
// @param baseURL {URL} the base url of the document for resolution purposes
// @throws {AssertionError}
// @returns {String} a favicon url, if found
FaviconLookup.prototype.search = function(document, baseURL) {
  assert(document instanceof Document);
  if(document.head) {
    const elements = document.head.querySelectorAll(this.LINK_SELECTOR);
    for(const element of elements) {
      const href = element.getAttribute('href');
      // hrefs may be relative
      const iconURL = this.resolveURL(href, baseURL);
      if(iconURL) {
        return iconURL.href;
      }
    }
  }
};

// Helper that resolves a url. If url is undefined, invalid, etc, then this returns undefined.
// Otherwise this returns a new URL representing the canonical url.
// @param url {String} optional url to resolve
// @param baseURL {URL}
// @throws {AssertionError}
// @returns {URL}
FaviconLookup.prototype.resolveURL = function(url, baseURL) {
  assert(baseURL instanceof URL);

  // Tolerate bad input for caller convenience
  if(typeof url !== 'string') {
    return;
  }

  // Do not pass an empty url to the URL constructor when base url is also defined as base url
  // becomes the resulting url without an error. This was previously the source of a bug, so as
  // annoying as it is, I am leaving this comment here as a continual reminder.

  // Check if the url is not just whitespace
  url = url.trim();
  if(url.length === 0) {
    return;
  }

  try {
    return new URL(url, baseURL);
  } catch(error) {
    // Ignore
  }
};

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
        newEntry.failureCount = entry.failureCount + 1;
        await this.cache.put(newEntry);
      }
    } else {
      newEntry.failureCount = 1;
      await this.cache.put(newEntry);
    }
  } else {
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    await this.cache.put(newEntry);
  }
};
