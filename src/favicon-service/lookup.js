import {detectURLChanged, fetchHTML} from "/src/common/fetch-utils.js";
import * as db from "/src/favicon-service/db.js";
import fetchImage from "/src/favicon-service/fetch-image.js";
import {assert, parseHTML, resolveURLString} from "/src/favicon-service/utils.js";
import * as defaults from "/src/favicon-service/defaults.js";

// TODO: decouple from all common libraries to provide a severe service boundary
// TODO: breakup the lookup function into smaller functions so it easier to read
// TODO: do tests after recent changes
// TODO: the url parameter should be separate from options
// TODO: the document parameter should be separate from options
// TODO: rather than max age approach, cached entries should specify their own lifetimes, and
// each new entry should get a default lifetime, and lookup caller should be able to provide
// a custom lifetime for any new entries

// Options:
//
// * console {Object} optional, a console object where logging information is sent. If not
// specified then a goes-nowhere-stub is used which effectively means no logging.
// * conn {IDBDatabase} optional, an open database connection to the favicon cache. If specified
// then the lookup will interact with the cache. If not specified then a cacheless lookup is done.
// * maxFailureCount {Number} optional, if the lookup detects that too many failures have been
// recorded in the cache then the lookup will exit early. If a cache is provided and the lookup
// fails then a corresponding failure will be recorded. Failures are aggregated by origin to limit
// the  amount of failure entries in the cache.
// * skipURLFetch {Boolean} optional, defaults to false, whether to skip attempting to fetch the
// html of the input url
// * maxAge {Number} optional, integer, defaults to a preset in defaults.js, the number of millis
// after which an entry is considered to have expired
// * fetchHTMLTimeout {Number} optional, integer, number of millis to wait before considering an
// attempt to fetch the html of a url a failure
// * fetchImageTimeout {Number} optional, integer, number of millis to wait before considering
// an attempt to fetch an image (response to HEAD request) is a failure
// * minImageSize {Number} optional, minimum size in bytes of an image for it to be considered
// a valid favicon
// * maxImageSize {Number} optional, maximum size in bytes of an image for it to be considered
// a valid favicon
// * url {URL} required, the url to lookup, typically some webpage
// * document {Document} optional, pre-fetched document that should be specified if the page
// was previously fetched

const defaultOptions = {
  maxFailureCount: defaults.MAX_FAILURE_COUNT,
  maxAge: defaults.MAX_AGE,
  skipURLFetch: defaults.SKIP_FETCH,
  fetchHTMLTimeout: defaults.FETCH_HTML_TIMEOUT,
  fetchImageTimeout: defaults.FETCH_IMAGE_TIMEOUT,
  minImageSize: defaults.MIN_IMAGE_SIZE,
  maxImageSize: defaults.MAX_IMAGE_SIZE,
  console: defaults.NULL_CONSOLE
};

// Lookup a favicon
export default async function lookupImpl(inputOptions) {

  // TODO: review Object.assign. I believe it is shallow but I've forgotten. Right now
  // document is a property and I do not want to be cloning it, just copying the reference
  // to it.

  // Merge options together. This treats inputOptions as immutable, and supplies defaults.
  const options = Object.assign({}, defaultOptions, inputOptions);

  assert(options.url instanceof URL);
  assert(typeof options.document === 'undefined' || options.document instanceof Document);
  options.console.log('Favicon lookup', options.url.href);

  const urls = [];
  urls.push(options.url.href);

  let originURL = new URL(options.url.origin);
  let originEntry;

  // Check the cache for the input url
  if(options.conn) {
    const entry = await db.findEntry(options.conn, options.url);
    if(entry.iconURLString && !entryIsExpired(entry, options)) {
      return entry.iconURLString;
    }
    if(originURL.href === options.url.href && entry.failureCount >= options.maxFailureCount) {
      options.console.debug('Too many failures', options.url.href);
      return;
    }
  }

  // If specified, examine the pre-fetched document
  if(options.document) {
    const iconURL = await searchDocument(options, options.document, options.url);
    if(iconURL) {
      if(options.conn) {
        await db.putAll(options.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if we reached the max failure count for the input url's origin (if we did not already
  // do the check above because input itself was origin)
  if(options.conn && originURL.href !== options.url.href) {
    originEntry = await db.findEntry(options.conn, originURL);
    if(originEntry && originEntry.failureCount >= options.maxFailureCount) {
      options.console.debug('Exceeded max lookup failures', originURL.href);
      return;
    }
  }

  // Try and fetch the html for the url. Non-fatal.
  let response;
  if(!document && !options.skipURLFetch) {
    try {
      response = await fetchHTML(url, options.fetchHTMLTimeout);
    } catch(error) {
      options.console.debug(error);
    }
  }

  // Handle redirect
  let responseURL;
  if(response) {
    responseURL = new URL(response.url);

    if(detectURLChanged(url, responseURL)) {

      // Update origin url for later
      if(responseURL.origin !== url.origin) {
        originURL = new URL(responseURL.origin);
      }

      // Add response url to the set of distinct urls investigated
      urls.push(responseURL.href);

      // Check the cache for the redirected url
      if(options.conn) {
        let entry = await db.findEntry(options.conn, responseURL);
        if(entry && entry.iconURLString && !entryIsExpired(entry, options)) {
          await db.putAll(options.conn, [url.href], entry.iconURLString);
          return entry.iconURLString;
        }
      }
    }
  }

  // We will be re-using the document variable, so avoid any ambiguity between a parse failure and
  // whether a pre-fetched document was specified
  options.document = null;

  // Deserialize the html response. Error is not fatal.
  if(response) {
    try {
      const text = await response.text();
      options.document = parseHTML(text);
    } catch(error) {
      options.console.debug(error);
    }
  }

  // Search the document. Errors are not fatal.
  if(options.document) {
    const baseURL = responseURL ? responseURL : options.url;
    let iconURL;
    try {
      iconURL = await searchDocument(options, options.document, baseURL);
    } catch(error) {
      options.console.debug(error);
    }

    if(iconURL) {
      if(options.conn) {
        await db.putAll(options.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if the origin is in the cache if it is distinct
  if(options.conn && !urls.includes(originURL.href)) {
    originEntry = await db.findEntry(options.conn, originURL);
    if(originEntry) {
      if(originEntry.iconURLString && !entryIsExpired(originEntry, options)) {
        await db.putAll(options.conn, urls, originEntry.iconURLString);
        return originEntry.iconURLString;
      } else if(originEntry.failureCount >= options.maxFailureCount) {
        options.console.debug('Exceeded failure count', originURL.href);
        return;
      }
    }
  }

  if(!urls.includes(originURL.href)) {
    urls.push(originURL.href);
  }

  // Check root directory
  const baseURL = responseURL ? responseURL : options.url;
  const imageURL = new URL(baseURL.origin + '/favicon.ico');
  response = null;
  try {
    response = await fetchImage(imageURL, options.fetchImageTimeout, options.minImageSize,
      options.maxImageSize);
  } catch(error) {
    options.console.debug(error);
  }

  if(response) {
    if(options.conn) {
      await db.putAll(options.conn, urls, response.url);
    }
    return response.url;
  }

  // Conditionally record failed lookup
  if(options.conn) {
    onLookupFailure(options.conn, originURL, originEntry);
  }
}

function onLookupFailure(conn, originURL, originEntry) {
  if(entry) {
    const newEntry = {};
    newEntry.pageURLString = entry.pageURLString;
    newEntry.dateUpdated = new Date();
    newEntry.iconURLString = entry.iconURLString;
    if('failureCount' in entry) {
      if(entry.failureCount <= this.kMaxFailureCount) {
        newEntry.failureCount = entry.failureCount + 1;
        db.putEntry(conn, newEntry);
      }
    } else {
      newEntry.failureCount = 1;
      db.putEntry(conn, newEntry);
    }
  } else {
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    db.putEntry(conn, newEntry);
  }
}

function entryIsExpired(entry, options) {
  // Tolerate partially corrupted data
  if(!entry.dateUpdated) {
    options.console.warn('Entry missing date updated', entry);
    return false;
  }

  const currentDate = new Date();
  const entryAge = currentDate - entry.dateUpdated;

  // Tolerate partially corrupted data
  if(entryAge < 0) {
    options.console.warn('Entry date updated is in the future', entry);
    return false;
  }

  return entryAge > options.maxAge;
}

async function searchDocument(options, document, baseURL) {
  assert(document instanceof Document);

  const candidates = findCandidateURLs(document);
  if(!candidates.length) {
    return;
  }

  let urls = [];
  for(const url of candidates) {
    const canonical = resolveURLString(url, baseURL);
    if(canonical) {
      urls.push(canonical);
    }
  }

  if(!urls.length) {
    return;
  }

  const seen = [];
  const distinct = [];
  for(const url of urls) {
    if(!seen.includes(url.href)) {
      distinct.push(url);
      seen.push(url.href);
    }
  }
  urls = distinct;

  for(const url of urls) {
    try {
      const response = await fetchImage(url, options.fetchImageTimeout, options.minImageSize,
        options.maxImageSize);
      if(response) {
        return response.url;
      }
    } catch(error) {
      // ignore
    }
  }
}

function findCandidateURLs(document) {
  const candidates = [];
  if(!document.head) {
    return candidates;
  }

  const selector = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');

  const links = document.head.querySelectorAll(selector);
  for(const link of links) {
    const href = link.getAttribute('href');
    if(href) {
      candidates.push(href);
    }
  }

  return candidates;
}
