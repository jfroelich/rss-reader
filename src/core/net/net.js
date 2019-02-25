import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as mime from '/src/lib/mime.js';

// A default permit-all policy
export function permit_all(request) {
  return true;
}

// A simple, custom, hardcoded, app-specific fetch policy
// * allow only http/https/data
// * allow only get/head
// * disallow loopback
// * disallow credentials
export function permit_default(request) {
  const good_protocols = ['data', 'http', 'https'];
  const good_methods = ['get', 'head'];
  const bad_hostnames = ['localhost', '127.0.0.1'];

  const url = request.url;
  const method = request.method ? request.method.toLowerCase() : 'get';
  const protocol = url.protocol.substring(0, url.protocol.length - 1);

  return good_protocols.includes(protocol) && !bad_hostnames(url.hostname) &&
      !url.username && !url.password && good_methods.includes(method);
}

// Call the native fetch with a timeout. The native fetch does not have a
// timeout, so we simulate it by racing it against a promise that resolves to
// undefined after a given time elapsed. |url| should be a URL. This does not
// supply any express default options and instead delegates to the browser, so
// if you want explicit default options then set them in options parameter.
export async function fetch_with_timeout(url, options = {}) {
  assert(url instanceof URL);
  assert(typeof options === 'object');

  // We plan to mutate options, so clone it to avoid surprising the caller with
  // a side effect
  const local_options = Object.assign({}, options);

  // Move timeout from options into a local
  let timeout = INDEFINITE;
  if (local_options.timeout) {
    timeout = local_options.timeout;
    assert(timeout instanceof Deadline);
    delete local_options.timeout;
  }

  let response;
  if (timeout.isDefinite()) {
    const timed_promise = sleep(timeout);
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

// Extends the builtin fetch with timeout, Accept validation, and policy
// constraints. Returns a response or throws an error.
// options.timeout - specify timeout as Deadline
// options.types - optional array of strings of mime types to check against
// options.is_allowed_request
export async function better_fetch(url, options = {}) {
  if (typeof url !== 'object' || !url.href) {
    throw new TypeError('url is not a URL: ' + url);
  }

  if (!navigator.onLine) {
    throw new OfflineError('Failed to fetch url while offline ' + url.href);
  }

  const is_allowed_request = options.is_allowed_request || permit_all;

  const request_data = {method: options.method, url: url};
  if (!is_allowed_request(request_data)) {
    const message =
        ['Refusing to request url', url.href, 'with method', options.method];
    throw new PolicyError(message.join(' '));
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

  let timeout;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;
    // do not forward to native fetch
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

  assert(timeout instanceof Deadline);

  const fetch_promise = fetch(url.href, merged_options);

  let response;
  if (timeout.isDefinite()) {
    response = await Promise.race([fetch_promise, sleep(timeout)]);
  } else {
    response = await fetch_promise;
    assert(response);
  }

  if (!response) {
    throw new TimeoutError('Timed out trying to fetch ' + url.href);
  }

  // If response is defined, then it must be of type Response or there is
  // some kind of programming error present. This assert validates the
  // above logic (which previously had a surprise bug with ternary op + await).
  assert(
      response instanceof Response, 'response is not a Response: ' + response);

  if (!response.ok) {
    const error_message_parts = [
      merged_options.method.toUpperCase(), url.href, ' failed with status',
      response.status, response.statusText
    ];

    throw new FetchError(error_message_parts.join(' '));
  }

  if (types && types.length) {
    const content_type = response.headers.get('Content-Type');
    const mime_type = mime.parse_content_type(content_type);
    if (!types.includes(mime_type)) {
      throw new AcceptError(
          'Unacceptable mime type ' + mime_type + ' for url ' + url.href);
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
export function response_is_redirect(request_url, response) {
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

// Return true if the error is a kind of temporary fetch error that is not
// indicative of a programming error
export function is_ephemeral_fetch_error(error) {
  return error instanceof FetchError || error instanceof PolicyError ||
      error instanceof TimeoutError;
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
  constructor(message = 'Refused to fetch url due to policy') {
    super(message);
  }
}

// This error indicates a resource cannot be fetched because something about the
// http request violates the app's policy. The caller defines the policy so this
// is all relative to the caller policy. An example policy violation might be
// that the policy only allows HTTPS requests but an HTTP request was made.
export class PolicyError extends Error {
  constructor(message = 'Refused to fetch url due to policy') {
    super(message);
  }
}

// When offline at time of sending request
export class OfflineError extends Error {
  constructor(message = 'Failed to fetch while offline') {
    super(message);
  }
}

// This error indicates a fetch operation took too long
export class TimeoutError extends Error {
  constructor(message = 'Failed to fetch due to timeout') {
    super(message);
  }
}
