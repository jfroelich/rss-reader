import assert from '/src/base/assert.js';
import * as mime from '/src/base/mime.js';

// TODO: there is nothing particularly idiosyncratic to this request over a
// request using any method. This could be easily refactored into a more generic
// http_fetch_image and work for any method. This moves the choice of method to
// the caller so it is more flexible and more reusable.

// TODO: documentation
// TODO: unit tests
// TODO: if i move the fetch calls from the control layer back to the library
// later there is a good chance that much of this functionality becomes
// redundant. The debate then is whether the favicon.js module as a whole should
// remain independent from those modules. Right now it is independent but I am
// unsure if it is worth the duplication. This module is severely identical.
// There is the related concern that perhaps this module itself should be
// independent of the favicon module given how reusable it is.

// Asynchronously send an HTTP HEAD request for an image. This accepts the same
// kind of options object as the native fetch, but it also supports an extra
// option, timeout, indicating the maximum time in milliseconds that the fetch
// can take. Return the response object if successful. Throws an error when
// using invalid parameters, when offline, when the native fetch call fails for
// some reason such as bad parameters or network error, when the fetch times
// out, when the response HTTP status code is not one of the successful codes,
// or when the response mime type is not one of the supported image mime types.
export async function http_head_image(url, options = {}) {
  assert(navigator && typeof navigator === 'object');
  assert(fetch && typeof fetch === 'function');
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  // Browsers have a tendency to switch out defaults from under us so it is not
  // wise to use implied defaults. Prefer privacy. Prefer being explicit.
  const default_fetch_options = {
    credentials: 'omit',
    method: 'head',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  // Extract options while not modifying the input parameter. User-specified
  // options override defaults by being assigned after the defaults.
  const merged_options = Object.assign({}, default_fetch_options, options);

  // Extract the custom timeout option from options and standardize the options
  // parameter to the native fetch call.
  let timeout = 0;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;

    // Validate timeout as an invariant condition
    assert(Number.isInteger(timeout) && timeout >= 0);

    // Ensure that the option is not forwarded to the native fetch call in case
    // native fetch throws when using non-standard options.
    delete merged_options.timeout;
  }

  // This function is only supposed to be sending a head request. Double check
  // that because the caller could have tried to override in options. I prefer
  // this error instead of just setting method here to avoid surprise.
  const method = merged_options.method;
  assert(method === 'string' && method.toLowerCase() === 'head');

  console.debug('HEAD', url.href);

  // Assert the precondition that we are online. Ordinarily the native fetch
  // call would later fail with a generic error. This traps that situation most
  // of the time and singles out the particular error path. Also note that we
  // do not call assert because this is not an invariant condition indicative
  // of a programming error, this is an ephemeral error related to a temporarily
  // unavaiable resource.
  if (!navigator.onLine) {
    throw new OfflineError('Offline when trying to fetch ' + url.href);
  }

  const response = await timed_fetch(url.href, merged_options, timeout);

  // Check if the HTTP response status code indicates failure.
  if (!response.ok) {
    const message = 'Got a ' + response.status + ' ' + response.statusText +
        ' error fetching ' + url.href;
    throw new FetchError(message);
  }

  // Validate the response content type.
  const content_type = response.headers.get('Content-Type');
  if (content_type) {
    const mime_type = mime.parse_content_type(content_type);
    const image_mime_types = [
      'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
      'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
      'image/vnd.microsoft.icon'
    ];

    if (mime_type && !image_mime_types.includes(mime_type)) {
      const message = 'Response mime type ' + mime_type +
          ' unacceptable for url ' + url.href;
      throw new AcceptError(message);
    }
  }

  console.debug(response.status + ' ' + response.statusText + ' ' + url.href);
  return response;
}

// Call the native fetch. The native fetch does not have a timeout, so we
// simulate it by racing it against a promise that resolves to undefined after a
// given time elapsed. |url| should be a string, not a URL object.
async function timed_fetch(url, options, timeout) {
  let response;
  if (timeout) {
    const timed_promise = delayed_resolve(timeout);
    const response_promise = fetch(url, options);
    const promises = [timed_promise, response_promise];
    response = await Promise.race(promises);
  } else {
    response = await fetch(url, options);
  }

  // The only case where response is ever undefined is when the timed promise
  // won the race against the fetch promise. Do not use assert because this is
  // ephemeral.
  if (!response) {
    throw new TimeoutError('Timed out fetching ' + url);
  }

  return response;
}

function delayed_resolve(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export class AcceptError extends Error {
  constructor(message) {
    super(message);
  }
}

export class OfflineError extends Error {
  constructor(message) {
    super(message);
  }
}

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
  }
}

export class FetchError extends Error {
  constructor(message) {
    super(message);
  }
}
