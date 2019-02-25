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

// Extends the builtin fetch with timeout, Accept validation, and policy
// constraints. Returns a response or throws an error.
// options.timeout - specify timeout as Deadline
// options.types - optional array of strings of mime types to check against
// options.is_allowed_request
export async function better_fetch(url, options = {}) {
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  if (!navigator.onLine) {
    throw new OfflineError('Failed to fetch url while offline ' + url.href);
  }

  // TODO: rename is_allowed_request option to just policy
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

    assert(timeout instanceof Deadline);

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

  // If response is defined, then it must be of type Response or there is
  // some kind of programming error present. This assert validates the
  // above logic (which previously had a surprise bug with ternary op + await).
  assert(response instanceof Response);

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

// This error indicates a resource cannot be fetched because something about the
// http request violates the app's policy. The caller defines the policy so this
// is all relative to the caller policy. An example policy violation might be
// that the policy only allows HTTPS requests but an HTTP request was made.
export class PolicyError extends Error {
  constructor(message = 'Policy violation') {
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
