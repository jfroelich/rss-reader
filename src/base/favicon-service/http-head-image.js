import assert from '/src/base/assert.js';
import * as mime from '/src/base/mime.js';

export async function http_head_image(url, options = {}) {
  assert(navigator && typeof navigator === 'object');
  assert(fetch && typeof fetch === 'function');
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  const default_fetch_options = {
    credentials: 'omit',
    method: 'head',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const merged_options = Object.assign({}, default_fetch_options, options);

  let timeout = 0;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;
    assert(Number.isInteger(timeout) && timeout >= 0);
    delete merged_options.timeout;
  }

  const method = merged_options.method;
  assert(method === 'string' && method.toLowerCase() === 'head');

  console.debug('HEAD', url.href);

  if (!navigator.onLine) {
    throw new OfflineError('Offline when trying to fetch ' + url.href);
  }

  const response = await timed_fetch(url.href, merged_options, timeout);

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
