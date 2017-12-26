import assert from "/src/utils/assert.js";
import * as FetchUtils from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// Sends a HEAD request for the given url. Throws if the response content type is not an image
// @param url {URL} request url
// @returns {Promise} a promise that resolves to a wrapped response object
export default function fetchImageHead(url, timeoutMs) {
  const headers = {accept: 'image/*'};
  const options = {
    credentials: 'omit',
    method: 'head',
    headers: headers,
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
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
    console.debug('Testing if %s is allowed mime type', mimeType);
    const types = ['application/octet-stream'];
    return MimeUtils.isImage(mimeType) || types.includes(mimeType);
  }

  return FetchUtils.fetchInternal(url, options, timeoutMs, isAcceptableMimeType);
}
