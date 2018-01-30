import {fromContentType} from '/src/common/mime-utils.js';

// TODO: rather than throw timeout error or other custom errors, consider
// creating an artificial response, setting the appropriate status code, and not
// asserting response.ok in tfetch. Instead, the caller can simply use
// `if(response.ok)` to determine what to do. This would remove the need to use
// try/catch everywhere, which would reduce a ton of boilerplate.

// Fetches the response of the given url. This basically does a tfetch but
// with an attached post-condition on mime-type. I've chosen not to parse
// the result immediately here, to allow the caller to interact with the
// response before involving more heavyweight parsing.
// @param url {URL} request url
// @param timeout {Number} optional, the number of millis to wait for a
// response before considering the request a failure.
// @throws {Error} if the response is not an html mime type
// @throws {Error} any of the errors thrown by tfetch
export async function fetchHTML(url, timeout) {
  const response = await tfetch(url, {timeout: timeout});
  const mimeType = getMimeType(response);
  assert(mimeType === 'text/html');
  return response;
}

const feedMimeTypes = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

// Fetches a feed. Returns a basic object, similar to Response, with custom
// properties.
// @param url {URL} request url
// @param timeout {Number} optional, timeout in milliseconds, before
// considering the fetch a failure
// @returns {Promise} a promise that resolves to a response
export async function fetchFeed(url, timeout) {
  const response = await tfetch(url, {timeout: timeout});
  const mimeType = getMimeType(response);
  assert(feedMimeTypes.includes(mimeType));
  return response;
}

// Does a fetch with a timeout
// @param url {URL} request url
// @param options {Object} optional, fetch options parameter. This extends the
// basic fetch api with a non-standard option, 'timeout', that if specified
// should be a positive integer, that causes fetch to fail if it takes longer
// than the given number of milliseconds
// @throws {TimeoutError} if the fetch takes too long
// @throws {Error} if the url parameter is invalid
// @throws {Error} if the fetch cannot be performed for policy reasons
// @returns {Response}
export async function tfetch(url, options) {
  assert(url instanceof URL);

  // Parameter options => custom defaults => fetch defaults
  const defaultOptions = {
    credentials: 'omit',
    method: 'get',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };
  const mergedOptions = Object.assign(defaultOptions, options);

  // Extract timeout from options
  let timeout;
  if ('timeout' in mergedOptions) {
    timeout = mergedOptions.timeout;
    // Avoid passing non-standard options to fetch
    delete mergedOptions.timeout;
  }

  const untimed = typeof timeout === 'undefined';
  if (!untimed) {
    assert(Number.isInteger(timeout) && timeout >= 0);
  }

  assert(isAllowedURL(url));

  const method = mergedOptions.method.toUpperCase();
  assert(method === 'GET' || method === 'HEAD');

  // Distinguish offline errors from general fetch errors
  assert(navigator && 'onLine' in navigator);
  if (!navigator.onLine) {
    throw new OfflineError(
        'Unable to fetch url ' + url.href + ' while offline');
  }

  const fetchPromise = fetch(url.href, mergedOptions);

  // If a timeout was specified, initialize a derived promise to the result of
  // racing fetch against timeout. Otherwise, initialize a derived promise to
  // the result of fetch.
  let aggregatePromise;
  if (untimed) {
    aggregatePromise = fetchPromise;
  } else {
    let timeoutPromise;
    timeoutPromise = sleep(timeout);
    const contestants = [fetchPromise, timeoutPromise];
    aggregatePromise = Promise.race(contestants);
  }

  const response = await aggregatePromise;

  // If timeout wins then response is undefined.
  if (!untimed && !response) {
    throw new TimeoutError('Fetch timed out for url ' + url.href);
  }

  assert(response.ok);
  return response;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Return true if the response url is 'different' than the request url
// @param requestURL {URL}
// @param responseURL {URL}
export function detectURLChanged(requestURL, responseURL) {
  return !compareURLsWithoutHash(requestURL, responseURL);
}

// Compares two urls for equality without considering hash values
function compareURLsWithoutHash(url1, url2) {
  // Mutate only clones to preserve purity
  const modURL1 = new URL(url1.href);
  const modURL2 = new URL(url2.href);
  modURL1.hash = '';
  modURL2.hash = '';
  return modURL1.href === modURL2.href;
}

// Returns the value of the response's Last-Modified header as a date, or
// undefined on error
export function getLastModified(response) {
  assert(response instanceof Response);

  const lastModifiedString = response.headers.get('Last-Modified');
  if (lastModifiedString) {
    // TODO: is try/catch needed around date constructor?
    try {
      const date = new Date(lastModifiedString);
      if (date.getTime() === date.getTime()) {
        return date;
      } else {
        console.debug('Date parsing error for string', lastModifiedString);
      }
    } catch (error) {
      console.debug(error);
    }
  }
}

export function getMimeType(response) {
  assert(response instanceof Response);
  const contentType = response.headers.get('Content-Type');
  if (contentType) {
    return fromContentType(contentType);
  }
}

// Return true if the app's policy permits fetching the url
// TODO: allow various overrides through localStorage setting or some config
// setting?
export function isAllowedURL(url) {
  assert(url instanceof URL);

  const protocol = url.protocol;
  const hostname = url.hostname;

  // Quickly check for data urls and allow them before any other tests. Data
  // URI fetches do not involve the network so there is no policy concern
  if (protocol === 'data:') {
    return true;
  }

  // Of course things like hosts file can be manipulated to whatever. This is
  // just one of the low-hanging fruits. Prevent fetches to local host urls.
  if (hostname === 'localhost') {
    return false;
  }

  // Again, ignores things like punycode, IPv6, host manipulation, local dns
  // manipulation, etc. This is just a simple and typical case
  if (hostname === '127.0.0.1') {
    return false;
  }

  const protocolBlacklist = ['about:', 'chrome:', 'chrome-extension:', 'file:'];

  if (protocolBlacklist.includes(protocol)) {
    return false;
  }

  // Prevent fetches of urls containing credentials. Although fetch implicitly
  // throws in this case, I prefer to explicit. Also, this is a public function
  // is use by other modules that may not call fetch (e.g. see
  // fetchImageElement) where I want the same policy to apply.
  if (url.username || url.password) {
    return false;
  }

  return true;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
  }
}

export class OfflineError extends Error {
  constructor(message) {
    super(message);
  }
}
