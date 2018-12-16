import assert from '/src/assert.js';

// Call the native fetch with a timeout. The native fetch does not have a
// timeout, so we simulate it by racing it against a promise that resolves to
// undefined after a given time elapsed. |url| should be a URL. This does not
// supply any express default options and instead delegates to the browser, so
// if you want explicit default options then set them in options parameter.
export async function fetch_with_timeout(url, options = {}) {
  assert(url instanceof URL);
  assert(typeof options === 'object');

  // Clone options because we may modify it and strive for purity.
  const local_options = Object.assign({}, options);

  // Move timeout from options into a local variable
  let timeout = 0;
  if ('timeout' in local_options) {
    timeout = local_options.timeout;
    assert(Number.isInteger(timeout) && timeout >= 0);
    delete local_options.timeout;
  }

  let response;
  if (timeout) {
    const timed_promise = delayed_resolve(timeout);
    const response_promise = fetch(url.href, local_options);
    const promises = [timed_promise, response_promise];
    response = await Promise.race(promises);
  } else {
    response = await fetch(url.href, local_options);
  }

  // The only case where response is ever undefined is when the timed promise
  // won the race against the fetch promise. Do not use assert because this is
  // ephemeral.
  if (!response) {
    throw new TimeoutError('Timed out fetching ' + url.href);
  }

  return response;
}

function delayed_resolve(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export class TimeoutError extends Error {}
