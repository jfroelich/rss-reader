// Favicion lookup functionality

import assert from "/src/assert.js";
import {isUncheckedError} from "/src/errors.js";
import FaviconCache from "/src/favicon-cache.js";
import {
  fetchHTML,
  fetchImageHead,
  FETCH_UNKNOWN_CONTENT_LENGTH
} from "/src/fetch.js";
import {isPosInt} from "/src/number.js";
import parseHTML from "/src/parse-html.js";
import {setURLHrefProperty} from "/src/url.js";

export default class FaviconLookup {
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
// @throws {Error} database related
// @returns {String} the associated favicon url or undefined if not found
FaviconLookup.prototype.lookup = async function(url, document) {
  assert(url instanceof URL);
  assert(typeof document === 'undefined' || document instanceof Document);

  console.debug('lookup', url.href);

  // Store a distinct set of request urls involved in the lookup so that various conditions are
  // simpler to implement and read
  const urls = [];
  urls.push(url.href);

  // Initialize the origin url to the origin of the input url. Non-const because it may change
  // on redirect.
  const originURL = new URL(url.origin);
  let originEntry;

  // If the cache is available, first check if the input url is cached
  if(this.hasOpenCache()) {
    const entry = await this.cache.findEntry(url);
    if(entry) {
      // If we found a fresh entry then exit early with the icon url
      if(entry.iconURLString && !this.isExpired(entry)) {
        return entry.iconURLString;
      }

      // Otherwise, if the input url is an origin, then check failure count
      if(originURL.href === url.href && entry.failureCount >= this.kMaxFailureCount) {
        return;
      }
    }
  }

  // If a pre-fetched document was specified, search it and possibly return.
  if(document) {
    const iconURL = this.search(document, url);
    if(iconURL) {
      if(this.hasOpenCache()) {
        // This affects both the input entry and the redirect entry
        // This does not affect the origin entry because per-page icons are not site-wide
        await this.cache.putAll(urls, iconURL);
      }
      return iconURL;
    }
  }

  // Before fetching, check if we reached the max failure count for requests to the origin, if the
  // origin is different than the input url. If the origin is the same we already checked.
  if(this.hasOpenCache()) {
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

      // If we redirected, and the origin of the response url is different than the origin of the
      // request url, then change the origin to the origin of the response url
      if(responseURL.origin !== url.origin) {
        setURLHrefProperty(originURL, responseURL.origin);
      }

      // Only append if distinct from input url. We only 'redirected' if 'distinct'
      urls.push(responseURL.href);
      if(this.hasOpenCache()) {
        const entry = await this.cache.findEntry(responseURL);
        if(entry && entry.iconURLString && !this.isExpired(entry)) {
          // Associate the redirect's icon with the input url.
          // This does not affect the redirect entry because its fine as is
          // This does not affect the origin entry because per-page icons do not apply site wide
          await this.cache.putAll([url.href], entry.iconURLString);
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
      if(this.hasOpenCache()) {
        // This does not modify the origin entry if it exists because a per-page icon does not apply
        // site wide. We have not yet added origin to the urls array.
        await this.cache.putAll(urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check the cache for the origin url if it is distinct from other urls already checked
  if(this.hasOpenCache() && !urls.includes(originURL.href)) {
    // Origin url may have changed, so searrch for its entry again
    const entry = await this.cache.findEntry(originURL);

    // Set the shared origin entry to the new origin entry, which signals to the lookup failure
    // handler not to perform the lookup again
    // TODO: except it doesn't signal to avoid the additional findEntry call properly,
    // because it may be undefined ... maybe the lookup handler should just accept an entry as
    // input instead of the origin url?
    originEntry = entry;

    if(entry) {
      const iconURL = entry.iconURLString;
      if(iconURL && !this.isExpired(entry)) {
        // Store the icon for the other urls
        // We did not yet add origin to urls array
        await this.cache.putAll(urls, iconURL);
        return iconURL;
      } else if(entry.failureCount >= this.kMaxFailureCount) {
        return;
      }
    }
  }

  // Now append origin to urls list in prep for next step so that it is included in the putAll call
  if(!urls.includes(originURL.href)) {
    urls.push(originURL.href);
  }

  // Check for favicon in the origin root directory
  const imageURL = url.origin + '/favicon.ico';
  response = await this.fetchImage(imageURL);

  if(this.isAcceptableImageResponse(response)) {
    if(this.hasOpenCache()) {
      await this.cache.putAll(urls, response.responseURL);
    }
    return response.responseURL;
  }

  if(this.hasOpenCache()) {
    await this.onLookupFailure(originURL, originEntry);
  }
};

// Return true if there is both a connected cache and that cache is in the open state
FaviconLookup.prototype.hasOpenCache = function() {
  return this.cache && this.cache.isOpen();
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
// @returns {Document}
FaviconLookup.prototype.parseHTMLResponse = async function(response) {
  try {
    const text = await response.text();
    return parseHTML(text);
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
// @param entry {Object} optional, the existing origin entry
FaviconLookup.prototype.onLookupFailure = async function(originURL, entry) {
  assert(this.cache);
  assert(this.hasOpenCache());

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
