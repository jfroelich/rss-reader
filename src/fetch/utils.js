import assert from "/src/utils/assert.js";
import {FetchError, NetworkError, OfflineError} from "/src/fetch/errors.js";
import isAllowedURL, {PermissionsError} from "/src/fetch/fetch-policy.js";
import fetchWithTimeout from "/src/fetch/fetch-with-timeout.js";
import {compareURLsWithoutHash} from "/src/utils/url-utils.js";
import {isValidURLString} from "/src/utils/url-string-utils.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as MimeUtils from "/src/utils/mime-utils.js";
import {setTimeoutPromise} from "/src/utils/promise-utils.js";
import parseInt10 from "/src/utils/parse-int-10.js";
import sprintf from "/src/utils/sprintf.js";

// TODO: rename to something like fetch-base.js or fetch-wrapper.js
// TODO: create a CustomResponse class and use that instead of returning a simple object?

// Does a fetch with a timeout and a content type predicate
// @param url {URL} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param acceptedMimeTypes {Array} optional, if specified then this checks if the response mime
// type is in the list of accepted types and throws a fetch error if not.
// @returns {Object} a Response-like object
export async function fetchInternal(url, options, timeoutMs, acceptedMimeTypes) {
  assert(url instanceof URL);

  // TODO: PermissionsError feels like a misnomer? Maybe stop trying to be so abstract and call it
  // precisely what it is, a FetchPolicyError or something.
  if(!isAllowedURL(url)) {
    const message = sprintf('Refused to fetch url', url);
    throw new PermissionsError(message);
  }

  const response = await fetchWithTimeout(url, options, timeoutMs);
  assert(response instanceof Response);

  if(!response.ok) {
    const message = sprintf('Response not ok for url "%s", status is', url, response.status);
    throw new FetchError(message);
  }

  // This is a caveat of not passing options along. But I want to programmatically specify that
  // 204 is only an error for certain methods
  const method = 'GET';
  if(method === 'GET' || method === 'POST') {
    const HTTP_STATUS_NO_CONTENT = 204;
    if(response.status === HTTP_STATUS_NO_CONTENT) {
      const message = sprintf('No content for GET/POST', url);
      throw new FetchError(message);
    }
  }

  // If the caller provided an array of acceptable mime types, then check whether the response
  // mime type is in the list of acceptable mime types
  if(Array.isArray(acceptedMimeTypes) && acceptedMimeTypes.length > 0) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = MimeUtils.fromContentType(contentType);
    if(!acceptedMimeTypes.includes(mimeType)) {
      const message = sprintf('Unacceptable mime type', mimeType, url);
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
