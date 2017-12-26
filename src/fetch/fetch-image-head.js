import assert from "/src/utils/assert.js";
import * as FetchUtils from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// Sends a HEAD request for the given url. Throws if the response content type is not an image
// @param url {URL} request url
// @returns {Promise} a promise that resolves to a wrapped response object
export default function fetchImageHead(url, timeoutMs) {
  const headers = {accept: 'image/*'};
  const options = {
    method: 'head',
    headers: headers,
    timeout: timeoutMs
  };

  // TODO: fully enumerate the list of acceptable types of images
  // This list is in development and not used
  const imageMimeTypes = [
    'application/octet-stream',
    'image/png',
    'image/vnd.microsoft.icon',
    'image/x-icon'
  ];

  function isAcceptableMimeType(mimeType) {
    // Just observational for now
    if(!imageMimeTypes.includes(mimeType)) {
      console.info('New image mime type encountered:', mimeType);
    }

    const types = ['application/octet-stream'];
    return MimeUtils.isImage(mimeType) || types.includes(mimeType);
  }

  return FetchUtils.fetchInternal(url, options, isAcceptableMimeType);
}
