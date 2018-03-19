import * as mime from '/src/mime/mime.js';

// Fictional codes for responses with errors. Codes must be in the range
// [200..599] or Chrome whines about throws a RangeError
export const STATUS_UNACCEPTABLE = 599;
export const STATUS_UNACCEPTABLE_TEXT = 'Unacceptable mime type';
export const STATUS_POLICY_REFUSAL = 598;
export const STATUS_POLICY_REFUSAL_TEXT = 'Refused to fetch';
export const STATUS_FORBIDDEN_METHOD = 597;
export const STATUS_FORBIDDEN_METHOD_TEXT = 'Forbidden request method';
export const STATUS_OFFLINE = 596;
export const STATUS_OFFLINE_TEXT = 'Offline';
export const STATUS_TIMEOUT = 595;
export const STATUS_TIMEOUT_TEXT = 'Request timed out';

function lookup_status_text(status) {
  switch (status) {
    case STATUS_UNACCEPTABLE:
      return STATUS_UNACCEPTABLE_TEXT;
    case STATUS_POLICY_REFUSAL:
      return STATUS_POLICY_REFUSAL_TEXT;
    case STATUS_FORBIDDEN_METHOD:
      return STATUS_FORBIDDEN_METHOD_TEXT;
    case STATUS_OFFLINE:
      return STATUS_OFFLINE_TEXT;
    case STATUS_TIMEOUT:
      return STATUS_TIMEOUT_TEXT;
    default:
      return undefined;
  }
}

function create_error_response(status) {
  let body = null;
  const init = {status: status, statusText: lookup_status_text(status)};
  return new Response(body, init);
}

export async function fetch_html(url, timeout) {
  const response = await tfetch(url, {timeout: timeout});
  if (!response.ok) {
    return response;
  }

  const mime_type =
      mime.parse_content_type(response.headers.get('Content-Type'));

  if (mime_type !== 'text/html') {
    return create_error_response(STATUS_UNACCEPTABLE);
  }

  return response;
}

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export async function fetch_feed(url, timeout) {
  const response = await tfetch(url, {timeout: timeout});

  if (!response.ok) {
    return response;
  }

  const mime_type =
      mime.parse_content_type(response.headers.get('Content-Type'));
  if (!feed_mime_types.includes(mime_type)) {
    return create_error_response(STATUS_UNACCEPTABLE);
  }

  return response;
}

export async function tfetch(url, options) {
  assert(url instanceof URL);

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
    delete merged_options.timeout;
  }

  const untimed = typeof timeout === 'undefined';
  if (!untimed) {
    assert(Number.isInteger(timeout) && timeout >= 0);
  }

  if (!url_is_allowed(url)) {
    return create_error_response(STATUS_POLICY_REFUSAL);
  }

  const method = merged_options.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return create_error_response(STATUS_FORBIDDEN_METHOD);
  }

  if (!navigator.onLine) {
    return create_error_response(STATUS_OFFLINE);
  }

  const fetch_promise = fetch(url.href, merged_options);
  const response = await (
      untimed ? fetch_promise : Promise.race([fetch_promise, sleep(timeout)]));
  if (!response) {
    return create_error_response(STATUS_TIMEOUT);
  }

  return response;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Return whether the response url is "different" than the request url,
// indicating a redirect, regardless of the value of response.redirected
export function url_did_change(request_url, response_url) {
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

export function url_is_allowed(url) {
  assert(url instanceof URL);

  const protocol = url.protocol;
  const hostname = url.hostname;

  // Quickly check for data urls and allow them before any other tests. Data
  // URI fetches do not involve the network so there is no policy concern
  if (protocol === 'data:') {
    return true;
  }

  if (hostname === 'localhost') {
    return false;
  }


  if (hostname === '127.0.0.1') {
    return false;
  }

  const protocol_blacklist =
      ['about:', 'chrome:', 'chrome-extension:', 'file:'];
  if (protocol_blacklist.includes(protocol)) {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  return true;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
