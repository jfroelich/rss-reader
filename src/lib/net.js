import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as mime from '/src/lib/mime.js';

// Extends native fetch with a few features:
// * specify options.timeout as a Deadline to enable timed fetching
// * specify options.types array of mime types to enforce response mime type
// check
// * checks connectivity to differentiate between a 404 error and offline
export async function better_fetch(url, options = {}) {
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  if (!navigator.onLine) {
    throw new OfflineError('Failed to fetch url while offline ' + url.href);
  }

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

  // Even though types is only used after fetch and therefore would preferably
  // be accessed later in this function's body, we must extract it out of the
  // options variable prior to fetch so as to avoid passing a non-standard
  // option to fetch
  let types;
  if (Array.isArray(merged_options.types)) {
    types = merged_options.types;
    delete merged_options.types;
  }

  const fetch_promise = fetch(url.href, merged_options);

  let response;
  if (timeout.isDefinite()) {
    response = await Promise.race([fetch_promise, sleep(timeout)]);
  } else {
    response = await fetch_promise;
  }

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
    if (!types.includes(mime_type)) {
      const message = 'Unacceptable type ' + mime_type + ' for url ' + url.href;
      throw new AcceptError(message);
    }
  }

  return response;
}

// Returns a promise that resolves to undefined after a given delay.
export function sleep(delay = INDEFINITE) {
  assert(delay instanceof Deadline);

  if (!delay.isDefinite()) {
    console.warn('sleeping indefinitely?');
    return Promise.resolve();
  }

  const time = delay.toInt();
  assert(Number.isInteger(time));
  return new Promise(resolve => {
    const timer_id = setTimeout(function() {
      resolve();
    }, time);
  });
}

// Return whether the response url is "different" than the request url,
// indicating a redirect, regardless of the value of response.redirected
export function is_redirect(request_url, response) {
  const response_url = new URL(response.url);
  return !url_compare_no_hash(request_url, response_url);
}

function url_compare_no_hash(url1, url2) {
  // operate on clones to avoid mutating input (stay "pure")
  const modified_url1 = new URL(url1.href);
  const modified_url2 = new URL(url2.href);
  modified_url1.hash = '';
  modified_url2.hash = '';
  return modified_url1.href === modified_url2.href;
}

// This error indicates a fetch operation failed for some reason like network
// unavailable, url could not be reached, etc
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

// When offline at time of sending request
export class OfflineError extends Error {
  constructor(message = 'Offline') {
    super(message);
  }
}

// This error indicates a fetch operation took too long
export class TimeoutError extends Error {
  constructor(message = 'Timeout') {
    super(message);
  }
}
