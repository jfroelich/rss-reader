import assert from "/src/utils/assert.js";
import {FetchError} from "/src/fetch/errors.js";
import fetchWithTimeout from "/src/fetch/fetch-with-timeout.js";
import isAllowedURL, {PermissionsError} from "/src/fetch/fetch-policy.js";
import * as FetchUtils from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";
import formatString from "/src/utils/format-string.js";

// TODO: this should be refactored to use fetchInternal. But I need to calculate content length.
// So fetchInternal first needs to be refactored to also calculate content length because response
// is not exposed, just wrapped response.

// Sends a HEAD request for the given image. When checking whether the response content type is
// an acceptable content type, this only checks the header value and does not perform any byte
// inspection. This means that this may occassionally incorrectly accept or reject certain requests
// for images.
// @param url {URL} request url
// @returns a simple object with props size and responseURL
export default async function fetchImageHead(url, timeoutMs) {
  assert(url instanceof URL);
  // timeout parameter is implicitly validated within fetchWithTimeout

  // Because this function does not go through fetchInternal currently, it skips the policy check
  // that applies to most other fetch functionality. So explicitly perform the check here to comply
  // with the general warranty that all fetch functionality meets policy constraints. If and when
  // this correctly uses fetchInternal then this check becomes implicit and is no longer needs here
  if(!isAllowedURL(url)) {
    const message = formatString('Refused to fetch url', url);
    throw new PermissionsError(message);
  }

  const headers = {accept: 'image/*'};
  const options = {
    credentials: 'omit',
    method: 'head',
    headers: headers,
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer'
  };

  const response = await fetchWithTimeout(url, options, timeoutMs);
  assert(typeof response !== 'undefined');

  // Check whether the response content type is acceptable
  const contentType = response.headers.get('Content-Type');
  const mimeType = MimeUtils.fromContentType(contentType);
  const types = ['application/octet-stream'];

  if(!MimeUtils.isImage(mimeType) && !types.include(mimeType)) {
    const message = formatString('Unacceptable mime type', mimeType, url);
    throw new FetchError(message);
  }

  // Rather than use expando properties on the builtin Response object, this creates a very basic
  // object that only exposes the two properties I think callers care about.
  const wrappedResponse = {};
  wrappedResponse.size = FetchUtils.getContentLength(response);
  wrappedResponse.responseURL = response.url;
  return wrappedResponse;
}
