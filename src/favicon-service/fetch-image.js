import {fetchHelper} from "/src/common/fetch-utils.js";
import {fromContentType as mimeFromContentType} from "/src/common/mime-utils.js";

// TODO: decouple from fetch-utils
// TODO: decouple from mime-utils

// TODO: think of a better name. it isn't obvious that this is a HEAD request. Or that it is
// restricted to the purpose of icons given that size constraints and mime constraints are
// built in. Something like sendIconHeadRequest
// TODO: despite moving in the size constraints and how convenient that is, now I am mixing
// together a few concerns. There is the pure concern of fetching mixed together with the
// additional constraint concern. Not sure how I feel about it.

// TODO: instead of returning undefined, return a fake Response object with the
// appropriate HTTP status error code.

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
