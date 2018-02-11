import {mime_type_from_content_type} from '/src/mime-utils.js';

// Fetches the response of the given url. This basically does a tfetch but
// with an attached post-condition on mime-type. I've chosen not to parse
// the result immediately here, to allow the caller to interact with the
// response before involving more heavyweight parsing.
// @param url {URL} request url
// @param timeout {Number} optional, the number of millis to wait for a
// response before considering the request a failure.
// @throws {Error} if the response is not an html mime type
// @throws {Error} any of the errors thrown by tfetch
export async function fetch_html(url, timeout) {
  const response = await tfetch(url, {timeout: timeout});
  assert(response_get_mime_type(response) === 'text/html');
  return response;
}

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

// Fetches a feed. Returns a basic object, similar to Response, with custom
// properties.
// @param url {URL} request url
// @param timeout {Number} optional, timeout in milliseconds, before
// considering the fetch a failure
// @returns {Promise} a promise that resolves to a response
export async function fetch_feed(url, timeout) {
  const response = await tfetch(url, {timeout: timeout});
  assert(feed_mime_types.includes(response_get_mime_type(response)));
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
  const default_options = {
    credentials: 'omit',
    method: 'get',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };
  const merged_options = Object.assign(default_options, options);

  // Extract timeout from options
  let timeout;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;
    // Avoid passing non-standard options to fetch
    delete merged_options.timeout;
  }

  const untimed = typeof timeout === 'undefined';
  if (!untimed) {
    assert(Number.isInteger(timeout) && timeout >= 0);
  }

  assert(url_is_allowed(url));

  const method = merged_options.method.toUpperCase();
  assert(method === 'GET' || method === 'HEAD');

  // Distinguish offline errors from general fetch errors
  assert(navigator && 'onLine' in navigator);
  if (!navigator.onLine) {
    throw new OfflineError('Unable to fetch ' + url.href + ' while offline');
  }

  const fetch_promise = fetch(url.href, merged_options);

  // If a timeout was specified, initialize a derived promise to the result of
  // racing fetch against timeout. Otherwise, initialize a derived promise to
  // the result of fetch.
  const response = await (
      untimed ? fetch_promise : Promise.race([fetch_promise, sleep(timeout)]));

  // If timeout wins then response is undefined.
  if (!untimed && !response) {
    throw new TimeoutError('Fetch timed out for url ' + url.href);
  }

  if (!response.ok) {
    throw new Error('Failed to fetch (' + response.status + ') ' + url.href);
  }

  return response;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Return true if the response url is 'different' than the request url,
// indicating a redirect, regardless of the value of response.redirected
// @param requestURL {URL}
// @param responseURL {URL}
export function url_did_change(requestURL, responseURL) {
  return !url_compare_no_hash(requestURL, responseURL);
}

// Compares two urls for equality without considering hash values
function url_compare_no_hash(url1, url2) {
  // Create and operate on clones to avoid mutating input
  const modified_url1 = new URL(url1.href);
  const modified_url2 = new URL(url2.href);
  modified_url1.hash = '';
  modified_url2.hash = '';
  return modified_url1.href === modified_url2.href;
}

// Returns the value of the response's Last-Modified header as a date, or
// undefined on error
export function response_get_last_modified_date(response) {
  assert(response instanceof Response);

  const header_value = response.headers.get('Last-Modified');
  if (header_value) {
    // TODO: is try/catch needed around date constructor?
    try {
      const date = new Date(header_value);

      // If the date constructor fails to parse, it simply stored NaN
      // internally, which is an invalid date, and NaN !== NaN
      if (date.getTime() === date.getTime()) {
        return date;
      } else {
        console.debug('Invalid date string:', header_value);
      }
    } catch (error) {
      console.debug(error);
    }
  }
}

export function response_get_mime_type(response) {
  assert(response instanceof Response);
  const content_type = response.headers.get('Content-Type');
  if (content_type) {
    return mime_type_from_content_type(content_type);
  }
}

// Return true if the app's policy permits fetching the url
// TODO: allow various overrides through localStorage setting or some config
// setting?
export function url_is_allowed(url) {
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

  const protocol_blacklist =
      ['about:', 'chrome:', 'chrome-extension:', 'file:'];
  if (protocol_blacklist.includes(protocol)) {
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
