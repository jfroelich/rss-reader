import {assert} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as mime from '/src/mime/mime.js';

// Extends native fetch with a timeout, response type checking, explicit options
// set for privacy, and translates the TypeError that native fetch throws when
// the network is unavailable into a custom NetworkError error type.
export async function better_fetch(url, options = {}) {
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  const default_options = {
    credentials: 'omit',
    method: 'get',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const merged_options = Object.assign({}, default_options, options);

  let timeout = INDEFINITE;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;
    assert(timeout instanceof Deadline);
    delete merged_options.timeout;
  }

  // Avoid passing a non-standard option to fetch
  let types;
  if (Array.isArray(merged_options.types)) {
    types = merged_options.types;
    delete merged_options.types;
  }

  const fetch_promise = fetch(url.href, merged_options);

  let response;
  try {
    if (timeout.isDefinite()) {
      response = await Promise.race([fetch_promise, sleep(timeout)]);
    } else {
      response = await fetch_promise;
    }
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    } else {
      // fetch throws a TypeError when offline (network unreachable), which
      // we translate into a network error. This should not be confused with
      // a 404 error, where the network works but the server returns 404
      throw new NetworkError(error.message);
    }
  }

  // response is defined when fetch wins the race, and undefined when sleep wins
  // the race.
  if (!response) {
    throw new TimeoutError('Timed out trying to fetch ' + url.href);
  }

  if (!response.ok) {
    const message = merged_options.method.toUpperCase() + ' ' + url.href +
        ' failed with status ' + response.status;
    throw new FetchError(message);
  }

  if (types && types.length) {
    const content_type = response.headers.get('Content-Type');
    const mime_type = mime.parse_content_type(content_type);
    if (mime_type && !types.includes(mime_type)) {
      const message = 'Unacceptable type ' + mime_type + ' for url ' + url.href;
      throw new AcceptError(message);
    }
  }

  return response;
}

function sleep(delay = INDEFINITE) {
  return new Promise(resolve => {
    setTimeout(resolve, delay.toInt());
  });
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
