import assert from "/src/assert/assert.js";
import {FetchError, NetworkError, OfflineError} from "/src/fetch/errors.js";
import isAllowedURL from "/src/fetch/fetch-policy.js";
import fetchWithTimeout from "/src/fetch/fetch-with-timeout.js";
import {PermissionsError} from "/src/operations/restricted-operation.js";
import {compareURLsWithoutHash} from "/src/url/url.js";
import {isValidURLString} from "/src/url/url-string.js";
import check from "/src/utils/check.js";
import isPosInt from "/src/utils/is-pos-int.js";
import * as mime from "/src/utils/mime-utils.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";
import {parseInt10} from "/src/utils/string.js";

// TODO: this module grew kind of large for my taste, move some functions into separate files

// TODO: consider changing fetchInternal to demand a URL object as input instead of a string, so
// that the check is pushed back to the caller and there is no longer a concern here. I also
// rather like the idea that URL is a more specific, specialized type than string. The tradeoff
// I suppose is the inconvenience. Note this will have a substantial ripple effect and may
// result in having to change the inputs to calling functions too, because callers typically
// also accept strings at the moment, I think.

// TODO: now that fetchInternal creates a url object, it is redundant with the check that occurs
// later in fetchWithTranslatedErrors. I should consider removing that check. But the concern is
// that it means callers shouldn't directly call to fetchWithTranslatedErrors otherwise they don't
// get the benefit of that check. That check has several benefits, outlined in comment in
// fetchWithTranslatedErrors function body.

// Does a fetch with a timeout and a content type predicate
// @param url {String} request url
// @param options {Object} optional, fetch options parameter
// @param timeoutMs {Number} optional, timeout in milliseconds
// @param acceptedMimeTypes {Array} optional, if specified then this checks if the response mime
// type is in the list of accepted types and throws a fetch error if not.
// @returns {Object} a Response-like object
export async function fetchInternal(url, options, timeoutMs, acceptedMimeTypes) {

  // Create a url object from the input string. This both asserts that the url is canonical, and
  // also prepares for the call to isAllowedURL
  let urlObject;
  try {
    urlObject = new URL(url);
  } catch(error) {
    // Catch and basically rethrow the same TypeError but with a nicer message
    throw new TypeError('Invalid url ' + url);
  }

  // Before fetching, check whether the url is fetchable according to this app's fetch policy.
  // TODO: PermissionsError feels like a misnomer? Maybe stop trying to be so abstract and call it
  // precisely what it is, a FetchPolicyRejectionError or something.
  // TODO: maybe isAllowedURL should just throw the error and this should just be a call to a
  // function named something like checkIsAllowedURL.
  check(isAllowedURL(urlObject), PermissionsError, 'Refused to fetch url', url);

  const response = await fetchWithTimeout(url, options, timeoutMs);

  // Throw an unchecked error if response is undefined as this represents a violation of a
  // contractual invariant. This should never happen and is unexpected.
  assert(response);

  check(response.ok, FetchError, 'Response not ok for url', url, 'and status is', response.status);

  const HTTP_STATUS_NO_CONTENT = 204;
  check(response.status !== HTTP_STATUS_NO_CONTENT, FetchError, 'No content response', url);

  // If the caller provided an array of acceptable mime types, then check whether the response
  // mime type is in the list of acceptable mime types
  if(Array.isArray(acceptedMimeTypes) && acceptedMimeTypes.length > 0) {
    const contentType = response.headers.get('Content-Type');
    // NOTE: apparently headers.get can return null when the header is not present. I finally
    // witnessed this event and it caused an assertion error in fromContentType. I modified
    // fromContentType to tolerate nulls so the assertion error no longer occurs. I should probably
    // revisit the documentation on response.headers.get because my belief is this is either
    // undocumented or perhaps some subtle behavior was changed in Chrome. It seems odd that this
    // is the first time ever seeing a response without a Content-Type header.
    const mimeType = mime.fromContentType(contentType);

    // TODO: perhaps throw a subclass of FetchError, like NotAcceptedError
    check(acceptedMimeTypes.includes(mimeType), FetchError, 'Response not accepted', url);
  }


  // TODO: create a ReaderResponse class and use that instead of a simple object?
  const responseWrapper = {};
  responseWrapper.text = function getBodyText() {
    return response.text();
  };
  responseWrapper.requestURL = url;
  responseWrapper.responseURL = response.url;
  responseWrapper.lastModifiedDate = getLastModified(response);

  const requestURLObject = new URL(url);
  const responseURLObject = new URL(response.url);
  responseWrapper.redirected = detectURLChanged(requestURLObject, responseURLObject);
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
