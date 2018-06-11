import {parse_content_type} from '/src/lib/mime.js';

const default_options = {
  credentials: 'omit',
  method: 'get',
  mode: 'cors',
  cache: 'default',
  redirect: 'follow',
  referrer: 'no-referrer',
  referrerPolicy: 'no-referrer'
};

const default_policy = {
  allows_url: function() {
    return true;
  },
  allows_method: function() {
    return true;
  }
};

// Extends the builtin fetch with timeout, response type checking, and a way to
// explicitly reject certain urls for policy reasons. Either returns a response,
// or throws an error of some kind.
// options.timeout - specify timeout in ms
// options.types - optional array of strings of mime types to check against
export async function fetch2(url, options = {}, policy = default_policy) {
  if (!('href' in url)) {
    throw new TypeError('url is not a URL: ' + url);
  }

  if (!navigator.onLine) {
    throw new OfflineError('Failed to fetch url while offline ' + url.href);
  }

  if (!policy.allows_url(url)) {
    throw new PolicyError(
        'Refusing to fetch url as against policy ' + url.href);
  }

  const merged_options = Object.assign({}, default_options, options);

  let timeout;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;
    // do not forward to native fetch
    delete merged_options.timeout;
  }

  let types;
  if (Array.isArray(merged_options.types)) {
    types = merged_options.types;
    // do not forward to native fetch
    delete merged_options.types;
  }

  const untimed = typeof timeout === 'undefined';
  if (!untimed) {
    if (!Number.isInteger(timeout) || timeout < 0) {
      throw new TypeError('timeout is not a positive integer');
    }
  }

  if (!policy.allows_method(merged_options.method)) {
    throw new PolicyError(
        'Refusing to fetch url as against policy ' + url.href);
  }

  const fetch_promise = fetch(url.href, merged_options);

  const response = await (
      untimed ? fetch_promise : Promise.race([fetch_promise, sleep(timeout)]));

  if (!response) {
    throw new TimeoutError('Timed out trying to fetch ' + url.href);
  }

  if (!response.ok) {
    throw new FetchError(
        'Error fetching ' + url.href + ' with status ' + response.status);
  }

  if (types && types.length) {
    const content_type = response.headers.get('Content-Type');
    const mime_type = parse_content_type(content_type);
    if (!types.includes(mime_type)) {
      throw new AcceptError(
          'Unacceptable mime type ' + mime_type + ' for url ' + url.href);
    }
  }

  return response;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// General fetch error
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

// When the request url violates policy
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

// When taking too long to receive response
export class TimeoutError extends Error {
  constructor(message = 'Failed to fetch due to timeout') {
    super(message);
  }
}
