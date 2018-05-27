import * as mime from '/src/lib/mime.js';

/*

# url-loader
Provides functionality for loading a resource via its URL. This module exists
primarily because:
* The native `fetch` function cannot timeout
* The native `response.redirected` property is weird
* Stricter mime type checking of `Accept` header (which seems to be ignored)

### todos
* abort-able/cancelable fetching


*/

// Fictional codes for responses with errors. Codes must be in the range
// [200..599] or Chrome whines about it and throws a RangeError
export const STATUS_UNACCEPTABLE = 599;
export const STATUS_UNACCEPTABLE_TEXT = 'Unacceptable mime type';
// 598 was forbidden method, that is now a part of policy refusal
export const STATUS_OFFLINE = 597;
export const STATUS_OFFLINE_TEXT = 'Offline';
export const STATUS_TIMEOUT = 596;
export const STATUS_TIMEOUT_TEXT = 'Request timed out';
export const STATUS_NETWORK_ERROR = 595;
export const STATUS_NETWORK_ERROR_TEXT = 'Unknown network error';
export const STATUS_RANGE_ERROR = 594;
export const STATUS_RANGE_ERROR_TEXT = 'Range error';
// NOTE: no valid rationale for jump to 594 to 590 here, it is just artifact of
// legacy code
export const STATUS_POLICY_REFUSAL = 590;
export const STATUS_POLICY_REFUSAL_TEXT = 'Refused to fetch';

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

export async function load(url, options = {}, policy = default_policy) {
  if (!('href' in url)) {
    throw new TypeError('url is not a URL: ' + url);
  }

  if (!policy.allows_url(url)) {
    console.debug('Refusing to fetch url as against policy', url.href);
    return create_error_response(STATUS_POLICY_REFUSAL);
  }

  const merged_options = Object.assign({}, default_options, options);

  let timeout;
  if ('timeout' in merged_options) {
    timeout = merged_options.timeout;
    delete merged_options.timeout;
  }

  let types;
  if (Array.isArray(merged_options.types)) {
    types = merged_options.types;
    delete merged_options.types;
  }

  const untimed = typeof timeout === 'undefined';
  if (!untimed) {
    if (!Number.isInteger(timeout) || timeout < 0) {
      throw new TypeError('timeout is not a positive integer');
    }
  }

  if (!policy.allows_method(merged_options.method)) {
    return create_error_response(STATUS_POLICY_REFUSAL);
  }

  if (!navigator.onLine) {
    return create_error_response(STATUS_OFFLINE);
  }

  const fetch_promise = fetch(url.href, merged_options);

  let response;
  try {
    response = await (
        untimed ? fetch_promise :
                  Promise.race([fetch_promise, sleep(timeout)]));
  } catch (error) {
    return create_error_response(STATUS_NETWORK_ERROR);
  }

  if (!response) {
    return create_error_response(STATUS_TIMEOUT);
  }

  if (types && types.length && response.ok) {
    const content_type = response.headers.get('Content-Type');
    const mime_type = mime.parse_content_type(content_type);
    if (!types.includes(mime_type)) {
      console.debug('Unacceptable mime type', mime_type, url.href);
      return create_error_response(STATUS_UNACCEPTABLE);
    }
  }

  return response;
}

function lookup_status_text(status) {
  switch (status) {
    case STATUS_UNACCEPTABLE:
      return STATUS_UNACCEPTABLE_TEXT;
    case STATUS_OFFLINE:
      return STATUS_OFFLINE_TEXT;
    case STATUS_TIMEOUT:
      return STATUS_TIMEOUT_TEXT;
    case STATUS_RANGE_ERROR:
      return STATUS_RANGE_ERROR_TEXT;
    case STATUS_POLICY_REFUSAL:
      return STATUS_POLICY_REFUSAL_TEXT;
    default:
      return undefined;
  }
}

export function create_error_response(status) {
  let body = null;
  const init = {status: status, statusText: lookup_status_text(status)};
  return new Response(body, init);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
