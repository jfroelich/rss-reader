import { Deadline, INDEFINITE } from '/lib/deadline.js';
import { FetchError, NetworkError, TimeoutError } from '/lib/better-fetch.js';
import assert from '/lib/assert.js';

// Return a promise that resolves to an image element.
//
// @param url {URL} the url of the image to fetch
// @param timeout {Deadline} the maximum time, in milliseconds, to wait before
// considering the fetch to take too long. optional. if not specified or
// indefinite (0) then no timeout is imposed.
//
// Throws various errors such as bad inputs, unable to fetch, able to fetch but
// no image found, operation took too long
export default async function fetchImageElement(url, timeout = INDEFINITE) {
  assert(url instanceof URL);
  assert(timeout instanceof Deadline);

  // Try to behave in a manner similar to better-fetch, which throws a network
  // error when unable to fetch (e.g. no network (offline)). This is different
  // than being online and pinging a url that does not exist (a 404 error).
  if (!navigator.onLine) {
    throw new NetworkError(`Failed to fetch ${url.href}`);
  }

  const fetchPromise = new Promise((resolve, reject) => {
    const proxy = new Image();
    proxy.src = url.href;

    // If the image is in the browser's cache, then its dimensions are already
    // known, and its width and height properties will already be initialized.
    // complete is true at least in certain browsers in this case, so there
    // is no need to wait until the image is loaded.
    if (proxy.complete) {
      resolve(proxy);
      return;
    }

    proxy.onload = () => resolve(proxy);

    // The error produced by the browser is opaque, uninformative, and all
    // around useless, so we substitute in an error that is informative.
    proxy.onerror = () => reject(new FetchError(`Failed to fetch ${url.href}`));
  });

  let image;
  if (timeout.isDefinite()) {
    // TEMP: researching an issue with excessive timeouts during polling
    console.debug(
      'Fetching image %s with timeout %d', url.href, timeout.toInt(),
    );

    image = await Promise.race([fetchPromise, timedResolve(timeout)]);
  } else {
    image = await fetchPromise;
  }

  if (!image) {
    throw new TimeoutError(`Timed out fetching ${url.href}`);
  }

  return image;
}

// Caution: using 0 means indefinite under the Deadline scheme, which suggests
// a promise that never resolves, but this will merrily trigger a near immediate
// timer using 0 (depending on the implicit per-browser minimum delay) that
// resolves very quickly. The caller should be careful of this counter intuitive
// design.
function timedResolve(delay) {
  return new Promise(resolve => setTimeout(resolve, delay.toInt()));
}
