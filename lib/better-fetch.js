import assert from '/lib/assert.js';
import { isAssertError } from '/lib/assert.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';
import * as mime from '/lib/mime-utils.js';

// Extends native fetch with a timeout, response type checking, explicit options
// set for privacy, and translates the TypeError that native fetch throws when
// the network is unavailable into a custom NetworkError error type.
export async function betterFetch(url, options = {}) {
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  const defaultOptions = {
    credentials: 'omit',
    method: 'get',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer',
  };

  const mergedOptions = Object.assign({}, defaultOptions, options);

  let timeout = INDEFINITE;
  if ('timeout' in mergedOptions) {
    timeout = mergedOptions.timeout;
    assert(timeout instanceof Deadline);
    delete mergedOptions.timeout;
  }

  // Avoid passing a non-standard option to fetch
  let types;
  if (Array.isArray(mergedOptions.types)) {
    types = mergedOptions.types;
    delete mergedOptions.types;
  }

  const fetchPromise = fetch(url.href, mergedOptions);

  let response;
  try {
    if (timeout.isDefinite()) {
      response = await Promise.race([fetchPromise, timedResolve(timeout)]);
    } else {
      response = await fetchPromise;
    }
  } catch (error) {
    if (isAssertError(error)) {
      throw error;
    } else {
      // fetch throws a TypeError when offline (network unreachable), which
      // we translate into a network error. This should not be confused with
      // a 404 error, where the network works but the server returns 404
      throw new NetworkError(error.message);
    }
  }

  // response is defined when fetch wins the race, and undefined when
  // timedResolve wins the race.
  if (!response) {
    throw new TimeoutError(`Timed out trying to fetch ${url.href}`);
  }

  if (!response.ok) {
    const message = `${mergedOptions.method.toUpperCase()} ${url.href
    } failed with status ${response.status}`;
    throw new FetchError(message);
  }

  if (types && types.length) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.parseContentType(contentType);
    if (mimeType && !types.includes(mimeType)) {
      const message = `Unacceptable type ${mimeType} for url ${url.href}`;
      throw new AcceptError(message);
    }
  }

  return response;
}

function timedResolve(delay = INDEFINITE) {
  return new Promise(resolve => setTimeout(resolve, delay.toInt()));
}

export class NetworkError extends Error {
  constructor(message = 'Unknown network error') {
    super(message);
  }
}

// This error indicates the response was not successful (returned something not
// in the [200-299] status range).
export class FetchError extends Error {
  constructor(message = 'Error fetching url') {
    super(message);
  }
}

// When the response is not acceptable
export class AcceptError extends Error {
  constructor(message = 'Unacceptable response type') {
    super(message);
  }
}

// This error indicates a fetch operation took too long
export class TimeoutError extends Error {
  constructor(message = 'Timeout') {
    super(message);
  }
}
