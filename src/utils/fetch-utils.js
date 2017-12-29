import assert from "/src/common/assert.js";
import formatString from "/src/common/format-string.js";
import * as MimeUtils from "/src/common/mime-utils.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import TimeoutError from "/src/utils/timeout-error.js";

// TODO: brainstorming, basically this is a partial implementation of a NetworkService
// of some kind. I could consider developing a standalone 'micro-service' that is fully
// independent of everything.  The service provides access to remote resources. So while it
// was probably smart to deprecate the fetch folder and move this back into utils, now I am
// changing this from a library of fetch utilities into the concept of a network service, which
// is basically responsible for serving files that are located elsewhere. Then I can build a
// service hierarchy. For example, the favicon service would depend on this network service.
// On the other hand, service boundaries are really more for distributed computing. This is all
// within a single app and the abstraction may create more problems than it solves. Perhaps
// just components is better, or modules, like what I have now. Or both. Services are comprised
// of functionality and an assembly of shared components.


// Fetches the html content of the given url
// @param url {URL} request url
// @param timeoutMs {Number} optional, in milliseconds, how long to wait before considering the
// fetch to be a failure.
export async function fetchHTML(url, timeoutMs) {
  const response = await fetchHelper(url, {
    timeout: timeoutMs
  });

  const mimeType = getMimeType(response);
  if(mimeType !== 'text/html') {
    const message = formatString('Unacceptable response mime type %s for url', mimeType, url);
    throw new FetchError(message);
  }

  return response;
}

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {URL} request url
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @returns {Promise} a promise that resolves to a response
export async function fetchFeed(url, timeoutMs) {
  const response = await fetchHelper(url, {timeout: timeoutMs});
  const mimeType = getMimeType(response);
  const types = ['application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/html', 'text/xml'];
  if(!types.includes(mimeType)) {
    const message = formatString('Unacceptable response mime type %s for url', mimeType, url);
    throw new FetchError(message);
  }
  return response;
}

// Does a fetch with a timeout
// @param url {URL} request url
// @param options {Object} optional, fetch options parameter. This extends the basic
// fetch api with a non-standard option, 'timeout', that if specified should be a positive integer,
// that causes fetches to fail if they take longer than the given number of milliseconds
// @returns {Object} a Response-like object. This extends (in the general sense) the basic
// Response object with properties that have already be converted to preferred data type
export async function fetchHelper(url, options) {
  // fetch implicitly canonicalizes its input url, which in this case would mean providing
  // chrome-extension:// to relative urls. To avoid this, this function demands a URL as input,
  // and because URLs must be canonical, this avoids the implicit resolution. In addition, fetch
  // throws a type error when given an invalid url parameter. This later translates all fetch
  // type errors into network errors, so avoid that by translating such type errors into assertion
  // errors before the call.
  assert(url instanceof URL);

  // fetch throws a TypeError when its options parameter is invalid. While normally desired, this
  // function is translating all type errors into network errors when calling fetch. Sidestep this
  // by translating this kind of error into an explicit assertion error.
  assert(typeof options === 'undefined' || typeof options === 'object');

  // Create a custom set of options where explicitly set options override the default options
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
  let timeoutMs;
  if('timeout' in mergedOptions) {
    timeoutMs = mergedOptions.timeout;
    // Admittedly superfluous, but avoid any unclear behavior with passing non-standard options
    // to fetch
    delete mergedOptions.timeout;
  }

  const untimed = typeof timeoutMs === 'undefined';
  assert(untimed || (Number.isInteger(timeoutMs) && timeoutMs >= 0));

  // Check if the url is allowed to be fetched according to this app's policy
  if(!isAllowedURL(url)) {
    const message = formatString('Cannot fetch url %s as it violates application policy', url);
    throw new PolicyError(message);
  }

  // Restrict methods
  const method = mergedOptions.method.toUpperCase();
  const allowedMethods = ['GET', 'HEAD'];
  if(!allowedMethods.includes(method)) {
    const message = 'Cannot fetch url %s as method %s violates application policy';
    const formattedMessage = formatString(message, url, method);
    throw new PolicyError(formattedMessage);
  }

  // Avoid the TypeError fetch throws when offline, and distinguish this type of network error from
  // other network errors. TypeErrors are unexpected and represent permanent programming errors.
  // Being offline is an expected and temporary error.
  assert(navigator && 'onLine' in navigator);
  if(!navigator.onLine) {
    const message = formatString('Offline when fetching', url);
    throw new OfflineError(message);
  }

  const fetchPromise = fetch(url.href, mergedOptions);

  // If a timeout was specified, initialize a derived promise to the result of racing fetch
  // against timeout. Otherwise, initialize a derived promise to the result of fetch.
  let aggregatePromise;
  let timeoutId;
  if(untimed) {
    aggregatePromise = fetchPromise;
  } else {
    let timeoutPromise;
    [timeoutId, timeoutPromise] = PromiseUtils.setTimeoutPromise(timeoutMs);
    const contestants = [fetchPromise, timeoutPromise];
    aggregatePromise = Promise.race(contestants);
  }

  let response;
  try {
    response = await aggregatePromise;
  } catch(error) {
    // fetch rejects with a TypeError when a network error is encountered, or when the url contains
    // credentials. It could also be a timeout, but that is a native timeout.
    if(error instanceof TypeError) {
      const message = formatString('Failed to fetch %s because of a network error', url, error);
      throw new NetworkError(message);
    } else {
      // TODO: when does this ever happen?
      console.warn('Unknown error type thrown by fetch', error);
      throw error;
    }
  }

  // If fetch wins then response is defined. If timeout wins then response is undefined.
  if(response) {
    clearTimeout(timeoutId);
  } else {
    // TODO: before exiting by throw, cancel the fetch, if that is possible
    const errorMessage = formatString('Fetch timed out for url', url);
    throw new TimeoutError(errorMessage);
  }

  if(!response.ok) {
    const message = formatString('Response not ok for url "%s", status is', url, response.status);
    throw new FetchError(message);
  }

  // response.ok is true for all status codes in the 200 range, but 204 No content is not expected
  // when using GET.
  const HTTP_STATUS_NO_CONTENT = 204;
  if(method === 'GET' && response.status === HTTP_STATUS_NO_CONTENT) {
    const message = formatString('No content for GET/POST for url', url);
    throw new FetchError(message);
  }

  return response;
}

// Return true if the response url is 'different' than the request url
// @param requestURL {URL}
// @param responseURL {URL}
export function detectURLChanged(requestURL, responseURL) {
  return !compareURLsWithoutHash(requestURL, responseURL);
}

// Compares two urls for equality without considering hash values
function compareURLsWithoutHash(url1, url2) {
  assert(url1 instanceof URL);
  assert(url2 instanceof URL);
  // Mutate only clones to preserve purity
  const modURL1 = new URL(url1.href);
  const modURL2 = new URL(url2.href);
  modURL1.hash = '';
  modURL2.hash = '';
  return modURL1.href === modURL2.href;
}

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as no header present or
// bad date
export function getLastModified(response) {
  assert(response instanceof Response);
  const lastModifiedString = response.headers.get('Last-Modified');
  if(lastModifiedString) {
    try {
      return new Date(lastModifiedString);
    } catch(error) {
      // Ignore
    }
  }
}

export function getContentLength(response) {
  assert(response instanceof Response);
  return parseInt(response.headers.get('Content-Length'), 10);
}

export function getMimeType(response) {
  assert(response instanceof Response);
  const contentType = response.headers.get('Content-Type');
  if(contentType) {
    return MimeUtils.fromContentType(contentType);
  }
}

// Return true if the app's policy permits fetching the url
// TODO: allow various overrides through localStorage setting or some config setting?
export function isAllowedURL(url) {
  assert(url instanceof URL);
  const protocol = url.protocol;
  const hostname = url.hostname;

  // Quickly check for data urls and allow them before any other tests. Data URI fetches do not
  // involve the network so there is no policy concern
  if(protocol === 'data:') {
    return true;
  }

  // Of course things like hosts file can be manipulated to whatever. This is just one of the
  // low-hanging fruits. Prevent fetches to local host urls.
  if(hostname === 'localhost') {
    return false;
  }

  // Again, ignores things like punycode, IPv6, host manipulation, local dns manipulation, etc.
  // This is just a simple and typical case
  if(hostname === '127.0.0.1') {
    return false;
  }

  const protocolBlacklist = [
    'about:',
    'chrome:',
    'chrome-extension:',
    'file:'
  ];

  if(protocolBlacklist.includes(protocol)) {
    return false;
  }

  // Prevent fetches of urls containing credentials. Although fetch implicitly throws in this case,
  // I prefer to explicit. Also, this is a public function is use by other modules that may not
  // call fetch (e.g. see fetchImageElement) where I want the same policy to apply.
  if(url.username || url.password) {
    return false;
  }

  return true;
}

// Represents a general class of networking errors, such as unavailability or unreachability of a
// resource located on a different machine
export class NetworkError extends Error {
  constructor(message) {
    super(message || 'Network error');
  }
}

// Represents a specific type of networking error where the current computer cannot access any
// resources on other machines
export class OfflineError extends NetworkError {
  constructor(message) {
    super(message || 'Offline error');
  }
}

// A general type of error thrown when attempting to fetch
export class FetchError extends Error {
  constructor(message) {
    super(message || 'Fetch error');
  }
}

// Thrown when attempting to fetch a url that is not allowed by fetch policy
export class PolicyError extends Error {
  constructor(message) {
    super(message || 'Attempted to fetch url that violates application fetch policy');
  }
}
