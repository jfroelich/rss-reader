import {detectURLChanged, fetchHTML} from "/src/common/fetch-utils.js";
import {
  clear as clearIconStore,
  compact as compactIconStore,
  findEntry,
  open as openIconStore,
  putAll,
  putEntry
} from "/src/favicon-service/db.js";
import fetchImage from "/src/favicon-service/fetch-image.js";
import {assert, parseHTML, resolveURLString} from "/src/favicon-service/utils.js";
import {MAX_AGE} from "/src/favicon-service/defaults.js";

// TODO: decouple from all common libraries to provide a severe service boundary
// TODO: breakup the lookup function into smaller functions so it easier to read
// TODO: do tests after recent changes

export const open = openIconStore;
export const clear = clearIconStore;
export const compact = compactIconStore;

// options props:
// conn - the idb database conn, optional
// maxFailureCount, integer
// skipURLFetch boolean
// maxAgeMs
// fetchHTMLTimeout
// fetchImageTimeout,
// minImageSize,
// maxImageSize
// url, URL, required, the webpage to find a favicon for
// document, Document, optional, pre-fetched document if available

const defaultOptions = {
  maxFailureCount: 2,
  maxAge: MAX_AGE,
  skipURLFetch: false,
  fetchHTMLTimeout: 400,
  fetchImageTimeout: 1000,
  minImageSize: 50,
  maxImageSize: 10240
};


// Lookup a favicon
export async function lookup(inputOptions) {

  // Merge options together. This treats inputOptions as immutable, and supplies defaults.
  const options = Object.assign({}, defaultOptions, inputOptions);

  assert(options.url instanceof URL);
  assert(typeof options.document === 'undefined' || options.document instanceof Document);
  console.log('Favicon lookup', options.url.href);

  const urls = [];
  urls.push(options.url.href);

  let originURL = new URL(options.url.origin);
  let originEntry;

  // Check the cache for the input url
  if(options.conn) {
    const entry = await findEntry(options.conn, options.url);
    if(entry.iconURLString && !isExpired(options.maxAge, entry)) {
      return entry.iconURLString;
    }
    if(originURL.href === options.url.href && entry.failureCount >= options.maxFailureCount) {
      console.debug('Too many failures', options.url.href);
      return;
    }
  }

  // If specified, examine the pre-fetched document
  if(options.document) {
    const iconURL = await searchDocument(options, options.document, options.url);
    if(iconURL) {
      if(options.conn) {
        await putAll(options.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if we reached the max failure count for the input url's origin (if we did not already
  // do the check above because input itself was origin)
  if(options.conn && originURL.href !== options.url.href) {
    originEntry = await findEntry(options.conn, originURL);
    if(originEntry && originEntry.failureCount >= options.maxFailureCount) {
      console.debug('Exceeded max lookup failures', originURL.href);
      return;
    }
  }

  // Try and fetch the html for the url. Non-fatal.
  let response;
  if(!document && !options.skipURLFetch) {
    try {
      response = await fetchHTML(url, options.fetchHTMLTimeout);
    } catch(error) {
      console.debug(error);
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
        let entry = await findEntry(options.conn, responseURL);
        if(entry && entry.iconURLString && !isExpired(options.maxAge, entry)) {
          await putAll(options.conn, [url.href], entry.iconURLString);
          return entry.iconURLString;
        }
      }
    }
  }

  // We will be re-using the document, so avoid any ambiguity between a parse failure and
  // whether options.document was specified
  options.document = null;

  // Deserialize the html response. Error is not fatal.
  if(response) {
    try {
      const text = await response.text();
      options.document = parseHTML(text);
    } catch(error) {
      console.debug(error);
    }
  }

  // Search the document. Errors are not fatal.
  if(options.document) {
    const baseURL = responseURL ? responseURL : options.url;
    let iconURL;
    try {
      iconURL = await searchDocument(options, options.document, baseURL);
    } catch(error) {
      console.debug(error);
    }

    if(iconURL) {
      if(options.conn) {
        await putAll(options.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if the origin is in the cache if it is distinct
  if(options.conn && !urls.includes(originURL.href)) {
    originEntry = await findEntry(options.conn, originURL);
    if(originEntry) {
      if(originEntry.iconURLString && !isExpired(options.maxAge, originEntry)) {
        await putAll(options.conn, urls, originEntry.iconURLString);
        return originEntry.iconURLString;
      } else if(originEntry.failureCount >= options.maxFailureCount) {
        console.debug('Exceeded failure count', originURL.href);
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
    console.debug(error);
  }

  if(response) {
    if(options.conn) {
      await putAll(options.conn, urls, response.url);
    }
    return response.url;
  }

  // Conditionally record failed lookup
  if(options.conn) {
    onLookupFailure(options.conn, originURL, originEntry);
  }
}


function isExpired(maxAge, entry) {
  // Tolerate partially corrupted data
  if(!entry.dateUpdated) {
    console.warn('Entry missing date updated', entry);
    return false;
  }

  const currentDate = new Date();
  const entryAge = currentDate - entry.dateUpdated;

  // Tolerate partially corrupted data
  if(entryAge < 0) {
    console.warn('Entry date updated is in the future', entry);
    return false;
  }

  return entryAge > maxAge;
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

function onLookupFailure(conn, originURL, originEntry) {
  if(entry) {
    const newEntry = {};
    newEntry.pageURLString = entry.pageURLString;
    newEntry.dateUpdated = new Date();
    newEntry.iconURLString = entry.iconURLString;
    if('failureCount' in entry) {
      if(entry.failureCount <= this.kMaxFailureCount) {
        newEntry.failureCount = entry.failureCount + 1;
        putEntry(conn, newEntry);
      }
    } else {
      newEntry.failureCount = 1;
      putEntry(conn, newEntry);
    }
  } else {
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    putEntry(conn, newEntry);
  }
}
