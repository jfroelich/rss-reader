import assert from "/src/assert/assert.js";
import {FetchError} from "/src/fetch/errors.js";
import * as FetchUtils from "/src/fetch/utils.js";
import check from "/src/utils/check.js";
import * as mime from "/src/utils/mime-utils.js";

// TODO: this should be refactored to use fetchInternal. But I need to calculate content length.
// So fetchInternal first needs to be refactored to also calculate content length because response
// is not exposed, just wrapped response.
// TODO: side note, does HEAD yield 204? If so, 204 isn't an error. So using fetchInternal
// would be wrong, at least as it is currently implemented.


// Sends a HEAD request for the given image.
// @param url {String}
// @returns a simple object with props size and responseURL
export default async function fetchImageHead(url, timeoutMs) {
  assert(typeof url === 'string');
  // TODO: sanity check timeoutMs

  const headers = {Accept: 'image/*'};

  // TODO: set properties in a consistent manner, like I do in other fetch modules
  const options = {};
  options.credentials = 'omit';
  options.method = 'HEAD';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';

  const response = await FetchUtils.fetchWithTimeout(url, options, timeoutMs);
  assert(response);

  // Validate the response content type header. As a policy matter, it must be an image mime type.
  // This currently does not do any byte inspection because that requires loading the whole file
  // via GET and some very slow and messy parsing stuff. Note that, as a result, this differs in
  // behavior from the browser, which can accept an invalid content type for an image but still
  // show or use the image because it does byte inspection or something that allows the bytes to
  // still be used. For example, https://www.oracle.com/favicon.ico responds with content type
  // "unknown", and Chrome is able to use it, but this rejects it.
  const contentType = response.headers.get('Content-Type');
  check(mime.isImage(contentType), FetchError,
    'Response content type header not an image mime type %s for url', contentType, url);

  // TODO: create and use ResponseWrapper?
  const wrappedResponse = {};
  wrappedResponse.size = FetchUtils.getContentLength(response);
  wrappedResponse.responseURL = response.url;
  return wrappedResponse;
}
