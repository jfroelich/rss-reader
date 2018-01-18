import {fetchHelper} from "/src/common/fetch-utils.js";

// TODO: decouple from fetch-utils

export default async function fetchImage(url, timeout, minImageSize, maxImageSize) {
  const options = {method: 'head', timeout: timeout};
  const response = await fetchHelper(url, options);

  // Only accept responses with an image-like mime-type
  const contentType = response.headers.get('Content-Type');
  if(!contentType) {
    console.debug('Response missing content type', url.href);
    return;
  }
  const mimeType = mimeFromContentType(contentType);
  if(!mimeType) {
    console.debug('Invalid content type', contentType, url.href);
    return;
  }

  if(!mimeType.startsWith('image/') && mimeType !== 'application/octet-stream') {
    console.debug('Unacceptable mime type', mimeType, url.href);
    return;
  }

  // Only accept images of a certain size
  const size = parseInt(response.headers.get('Content-Length'), 10);
  if(Number.isInteger(size)) {
    if(size < minImageSize) {
      console.debug('Content length too small', size, url.href);
      return;
    }
    if(size > maxImageSize) {
      console.debug('Content length too large', size, url.href);
      return;
    }
  } else {
    // Allow unknown size
  }

  return response;
}
