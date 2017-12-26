import assert from "/src/utils/assert.js";
import {FetchError, NetworkError, OfflineError} from "/src/fetch/errors.js";
import isAllowedURL, {PermissionsError} from "/src/fetch/fetch-policy.js";
import formatString from "/src/utils/format-string.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as MimeUtils from "/src/utils/mime-utils.js";
import parseInt10 from "/src/utils/parse-int-10.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import TimeoutError from "/src/utils/timeout-error.js";
import {compareURLsWithoutHash} from "/src/utils/url-utils.js";
import {isValidURLString} from "/src/utils/url-string-utils.js";

// TODO: create a CustomResponse class and use that instead of returning a simple object?

// Does a fetch with a timeout and a content type predicate
// @param url {URL} request url
// @param options {Object} optional, fetch options parameter
// @param acceptedMimeTypes {Array or Function} optional, if specified then this checks if the
// response mime type is in the list of accepted types and throws a fetch error if not, or if it
// is a function then if calling the function on the mime type returns true (otherwise throws).
// @returns {Object} a Response-like object
export async function fetchInternal(url, options, acceptedMimeTypes) {
  // Accepting a url ensures the url is canonical and thereby avoids allowing fetch to implicitly
  // resolve a relative url string
  assert(url instanceof URL);

  // Avoid the TypeError fetch throws for invalid options, treat it as an assertion error
  assert(typeof options === 'undefined' || typeof options === 'object');

  // TODO: get timeoutMs from options. I am going to call it timeout.

  let timeoutMs;
  if(typeof options === 'object') {
    if('timeout' in options) {
      timeoutMs = options.timeout;
      // Leave the timeout property in the options object so as to avoid side effect
      // The fetch call seems to tolerate irrelevant properties
      // This gets removed later anyway
    }
  }

  const untimed = typeof timeoutMs === 'undefined';
  assert(untimed || isPosInt(timeoutMs));

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
  const mergedOptions = options ? Object.assign(defaultOptions, options) : defaultOptions;

  // Now that merged options is a copy of options, remove any non-standard options
  // This may not be necessary but I'd prefer to avoid unknown behavior
  if('timeout' in mergedOptions) {
    delete mergedOptions.timeout;
  }

  // Check if the url is allowed to be fetched according to this app's policy
  // TODO: PermissionsError feels like a misnomer? Maybe stop trying to be so abstract and call it
  // precisely what it is, a FetchPolicyError or something.
  if(!isAllowedURL(url)) {
    const message = formatString('Refused to fetch url', url);
    throw new PermissionsError(message);
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

  // This is a caveat of not passing options along. But I want to programmatically specify that
  // 204 is only an error for certain methods
  const method = 'GET';
  if(method === 'GET' || method === 'POST') {
    const HTTP_STATUS_NO_CONTENT = 204;
    if(response.status === HTTP_STATUS_NO_CONTENT) {
      const message = formatString('No content for GET/POST', url);
      throw new FetchError(message);
    }
  }

  // If the caller provided an array of acceptable mime types, then check whether the response
  // mime type is in the list of acceptable mime types
  if(Array.isArray(acceptedMimeTypes) && acceptedMimeTypes.length > 0) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = MimeUtils.fromContentType(contentType);
    if(!acceptedMimeTypes.includes(mimeType)) {
      const message = formatString('Unacceptable mime type', mimeType, url);
      throw new FetchError(message);
    }
  } else if(typeof acceptedMimeTypes === 'function') {

    // The function handler is a quick hacky addition to allow for fetchImageHead to call
    // fetchInternal. The issue is that fetchImageHead doesn't use an enumerated list of
    // mime types. Instead it uses a partially enumerated list and a function call that
    // tests if mime type starts with 'image/'.
    // TODO: think how to avoid this hack eventually. Maybe enumerate the types.
    // Or maybe allow for wild card matching. Or maybe live with it.

    const contentType = response.headers.get('Content-Type');
    const mimeType = MimeUtils.fromContentType(contentType);
    if(!acceptedMimeTypes(mimeType)) {
      const message = formatString('Unacceptable mime type', mimeType, url);
      throw new FetchError(message);
    }
  }

  const responseWrapper = {};
  responseWrapper.text = function getBodyText() {
    return response.text();
  };
  responseWrapper.requestURL = url.href;
  responseWrapper.responseURL = response.url;
  responseWrapper.lastModifiedDate = getLastModified(response);

  // TODO: I think I would prefer this is called contentLength
  responseWrapper.size = getContentLength(response);

  // This should never throw as the browser never generates a bad property value
  const responseURLObject = new URL(response.url);
  responseWrapper.redirected = detectURLChanged(url, responseURLObject);

  return responseWrapper;
}


// Return true if the response url is 'different' than the request url
// @param requestURL {URL}
// @param responseURL {URL}
function detectURLChanged(requestURL, responseURL) {
  return !compareURLsWithoutHash(requestURL, responseURL);
}

// Returns the value of the Last-Modified header as a Date object
// @param response {Response}
// @returns {Date} the value of Last-Modified, or undefined if error such as no header present or
// bad date
function getLastModified(response) {
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

// TODO: actually this is only ever called by fetch-image-head, move it back to there so that
// utils becomes a file of just fetchInternal, at which point I can rename utils.js to something
// more specific, and change it to export a default function.

export const FETCH_UNKNOWN_CONTENT_LENGTH = -1;

// TODO: just return NaN if NaN? NaN is suitable unknown type.
export function getContentLength(response) {
  const contentLengthString = response.headers.get('Content-Length');

  if(typeof contentLengthString !== 'string' || contentLengthString.length < 1) {
    return FETCH_UNKNOWN_CONTENT_LENGTH;
  }

  const contentLength = parseInt10(contentLengthString);
  return isNaN(contentLength) ? FETCH_UNKNOWN_CONTENT_LENGTH : contentLength;
}
