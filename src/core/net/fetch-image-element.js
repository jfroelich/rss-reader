import {FetchError, permit_all, PolicyError, sleep, TimeoutError} from '/src/core/net/net.js';
import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';

// TODO: avoid sending cookies, probably need to use fetch api and give up on
// using the simple element.src trick, it looks like HTMLImageElement does not
// allow me to control the request parameters and does send cookies, but I need
// to review this more, I am still unsure.

// Return a promise that resolves to an image element. The image is loaded by
// proxy, which in other words means that we use a new, separate image element
// attached to the same document executing this function to load the image. The
// resulting image is NOT attached to the document that contained the image that
// had the given url. The proxy is used because we cannot reliably load images
// using the HTMLImageElement src setter method if we do not know for certain
// whether the document is live or inert. Documents created by DOMParser and
// XMLHttpRequest are inert. In an inert document the src setter method does not
// work.
// @param url {URL}
// @param timeout {Number}
// @param is_allowed_request {Function} optional, is given a request-like
// object, throws a policy error if the function returns false
export async function fetch_image_element(
    url, timeout = INDEFINITE, is_allowed_request = permit_all) {
  assert(url instanceof URL);
  assert(timeout instanceof Deadline);
  assert(is_allowed_request instanceof Function);

  const request_data = {method: 'GET', url: url};
  if (!is_allowed_request(request_data)) {
    throw new PolicyError('Refused to fetch ' + url.href);
  }

  const fetch_promise = new Promise((resolve, reject) => {
    const proxy = new Image();
    proxy.src = url.href;
    if (proxy.complete) {
      resolve(proxy);
      return;
    }

    proxy.onload = _ => resolve(proxy);
    const error = new FetchError('Fetch image error ' + url.href);
    proxy.onerror = _ => reject(error);
  });

  let image;
  if (timeout.isDefinite()) {
    image = await Promise.race([fetch_promise, sleep(timeout)]);
  } else {
    image = await fetch_promise;
  }

  if (!image) {
    throw new TimeoutError('Timed out fetching ' + url.href);
  }
  return image;
}
