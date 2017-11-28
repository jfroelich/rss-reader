import assert from "/src/assert/assert.js";
import {check} from "/src/utils/errors.js";
import * as FetchUtils from "/src/fetch/utils.js";
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

  // Validate the content type
  const contentType = response.headers.get('Content-Type');
  if(contentType === 'unknown') {
    // See https://github.com/jfroelich/rss-reader/issues/459
    console.debug('allowing unknown content type of response when requesting', url);
  } else {
    check(mime.isImage(contentType), FetchUtils.FetchError,
      'Response content type not an image mime type', contentType, 'for url', url);
  }

  // TODO: create and use ResponseWrapper?
  const wrappedResponse = {};
  wrappedResponse.size = FetchUtils.getContentLength(response);
  wrappedResponse.responseURL = response.url;
  return wrappedResponse;
}
