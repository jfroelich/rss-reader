// Fetches an image element. Returns a promise that resolves to a fetched image
// element.
// @param url {URL}
// @param timeout {Number}
// @param is_allowed_request {Function}
// @returns {Promise}
export async function fetch_image_element(url, timeout, is_allowed_request) {
  assert(
      typeof timeout === 'undefined' || timeout === null ||
      (Number.isInteger(timeout) && timeout >= 0));
  const fetch_promise = executor(url, is_allowed_request);
  const contestants =
      timeout ? [fetch_promise, sleep(timeout)] : [fetch_promise];
  const image = await Promise.race(contestants);
  assert(image, 'Timed out fetching image url ' + url.href);
  return image;
}

function executor(url, is_allowed_request) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    assert(is_allowed_request('get', url));

    // Create a proxy element within this script's document
    const proxy = new Image();
    // Set the proxy's source to trigger the fetch
    proxy.src = url.href;

    // If cached then resolve immediately
    if (proxy.complete) {
      return resolve(proxy);
    }

    proxy.onload = () => resolve(proxy);
    proxy.onerror = (event) => {
      // NOTE: the event does not contain a useful error object, or any error
      // information at all really, so create our own error
      reject(new Error('Unknown error fetching image ' + url.href));
    };
  });
}

// Returns a promise that resolves to undefined after a given amount of time (in
// milliseconds). By racing this promise against another promise, this is useful
// for imposing a timeout on the other operation.
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
