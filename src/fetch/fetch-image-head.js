import assert from "/src/assert/assert.js";
import {FetchError} from "/src/fetch/errors.js";
import fetchWithTimeout from "/src/fetch/fetch-with-timeout.js";
import * as FetchUtils from "/src/fetch/utils.js";
import check from "/src/utils/check.js";
import * as MimeUtils from "/src/mime/utils.js";

// TODO: this should be refactored to use fetchInternal. But I need to calculate content length.
// So fetchInternal first needs to be refactored to also calculate content length because response
// is not exposed, just wrapped response.
// TODO: if not using fetchInternal, sanity check timeoutMs
// TODO: set fetch properties using same style as in other fetch helper functions
// TODO: if not using fetchInternal, create and use ResponseWrapper?

// Sends a HEAD request for the given image.
// This currently does not do any byte inspection, only mime type acceptance check, which causes
// this to respond differently than the browser sometimes
// @param url {URL}
// @returns a simple object with props size and responseURL
export default async function fetchImageHead(url, timeoutMs) {
  assert(url instanceof URL);

  const headers = {Accept: 'image/*'};
  const options = {};
  options.credentials = 'omit';
  options.method = 'HEAD';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';

  const response = await fetchWithTimeout(url, options, timeoutMs);
  assert(response);

  // TODO: this could probably be expressed in a clearer way, for now I am hackishly adding
  // support for application/octet-stream to stop favicon lookup from failing on certain websites
  const contentType = response.headers.get('Content-Type');
  check(MimeUtils.isImage(contentType) || isOtherAcceptableMimeType(contentType), FetchError,
    'Unacceptable mime type', contentType, url);

  const wrappedResponse = {};
  wrappedResponse.size = FetchUtils.getContentLength(response);
  wrappedResponse.responseURL = response.url;
  return wrappedResponse;
}

function isOtherAcceptableMimeType(contentType) {
  // To support twitch.tv, support 'application/octet-stream'
  const mimeType = MimeUtils.fromContentType(contentType);
  const otherTypes = ['application/octet-stream'];
  return otherTypes.includes(mimeType);
}
