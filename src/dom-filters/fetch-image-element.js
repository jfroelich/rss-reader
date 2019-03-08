import {assert} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import {FetchError, OfflineError, sleep, TimeoutError} from '/src/net/net.js';

// TODO: i do not need the element in any use case, just its dimensions, so the
// vision for this module should be changed to something like
// fetch-image-dimensions that returns {x:0, y:0}.

// TODO: avoid sending cookies, probably need to use fetch api and give up on
// using the simple element.src trick, it looks like HTMLImageElement does not
// allow me to control the request parameters and does send cookies, but I need
// to review this more, I am still unsure.

// Return a promise that resolves to an image element.
// @param url {URL}
// @param timeout {Number}
export async function fetch_image_element(url, timeout = INDEFINITE) {
  assert(url instanceof URL);
  assert(timeout instanceof Deadline);

  if (!navigator.onLine) {
    const message = 'Failed to fetch image element while offline ' + url.href;
    throw new OfflineError(message);
  }

  const fetch_promise = new Promise((resolve, reject) => {
    const proxy = new Image();
    proxy.src = url.href;
    if (proxy.complete) {
      resolve(proxy);
      return;
    }

    proxy.onload = _ => resolve(proxy);
    proxy.onerror = _ =>
        reject(new FetchError('Fetch image error ' + url.href));
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
