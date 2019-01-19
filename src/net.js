import assert from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as mime from '/src/mime.js';
import {parse_feed} from '/src/parse-feed.js';

// Call the native fetch with a timeout. The native fetch does not have a
// timeout, so we simulate it by racing it against a promise that resolves to
// undefined after a given time elapsed. |url| should be a URL. This does not
// supply any express default options and instead delegates to the browser, so
// if you want explicit default options then set them in options parameter.
export async function fetch_with_timeout(url, options = {}) {
  assert(url instanceof URL);
  assert(typeof options === 'object');

  // Clone options because we may modify it and strive for purity.
  const local_options = Object.assign({}, options);

  // Move timeout from options into a local variable
  let timeout = 0;
  if ('timeout' in local_options) {
    timeout = local_options.timeout;
    assert(Number.isInteger(timeout) && timeout >= 0);
    delete local_options.timeout;
  }

  let response;
  if (timeout) {
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

// Returns whether a given request is fetchable according to the app's policy.
// This hardcodes the app's policy into a function. In general, only
// http-related fetches are permitted, and not against local host. This also
// disallows embedded credentials explicitly despite that being an implicit
// constraint imposed by the native fetch.
// This function represents the app's default fetch policy. Callers can
// optionally provide a different policy to fetch functions provided they
// follow this signature.
export function is_allowed_request(request) {
  const method = request.method || 'GET';
  const url = request.url;

  const allowed_protocols = ['data', 'http', 'https'];
  const allowed_methods = ['GET', 'HEAD'];

  const protocol = url.protocol.substring(0, url.protocol.length - 1);

  return allowed_protocols.includes(protocol) && url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1' && !url.username && !url.password &&
      allowed_methods.includes(method.toUpperCase());
}

export function fetch_html(url, options = {}) {
  const opts = Object.assign({}, options);
  const policy = options.policy || is_allowed_request;
  const types = ['text/html'];
  if (options.allow_text) {
    types.push('text/plain');
  }
  opts.types = types;

  // Delete non-standard options just in case the eventual native call to
  // fetch would barf on seeing them
  delete opts.allow_text;

  return better_fetch(url, opts);
}

// Extends the builtin fetch with timeout, response type checking, and a way to
// explicitly reject certain urls for policy reasons. Either returns a response,
// or throws an error of some kind.
// options.timeout - specify timeout in ms
// options.types - optional array of strings of mime types to check against
// options.is_allowed_request
export async function better_fetch(url, options = {}) {
  if (typeof url !== 'object' || !url.href) {
    throw new TypeError('url is not a URL: ' + url);
  }

  if (!navigator.onLine) {
    throw new OfflineError('Failed to fetch url while offline ' + url.href);
  }

  const is_allowed_request = options.is_allowed_request;

  const request_data = {method: options.method, url: url};
  if (is_allowed_request && !is_allowed_request(request_data)) {
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

  const untimed = typeof timeout === 'undefined';
  if (!untimed) {
    if (!Number.isInteger(timeout) || timeout < 0) {
      throw new TypeError('timeout is not a positive integer');
    }
  }

  const fetch_promise = fetch(url.href, merged_options);
  const response = await (
      untimed ? fetch_promise : Promise.race([fetch_promise, sleep(timeout)]));

  if (!response) {
    throw new TimeoutError('Timed out trying to fetch ' + url.href);
  }

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

export async function fetch_image(url, options = {}) {
  assert(navigator && typeof navigator === 'object');
  assert(fetch && typeof fetch === 'function');
  assert(url instanceof URL);
  assert(options && typeof options === 'object');

  const default_fetch_options = {
    credentials: 'omit',
    method: 'get',
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  // Use our explicit defaults over the browser's defaults
  const merged_options = Object.assign({}, default_fetch_options, options);

  const supported_methods = ['get', 'head'];
  const method = merged_options.method;
  assert(
      typeof method === 'string' &&
      supported_methods.includes(method.toLowerCase()));
  console.debug(method.toUpperCase(), url.href);

  if (!navigator.onLine) {
    throw new OfflineError('Offline when trying to fetch ' + url.href);
  }

  const response = await fetch_with_timeout(url, merged_options);

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

  console.debug(response.status, response.statusText, url.href);
  return response;
}

// Returns a promise that resolves to undefined after a given amount of
// milliseconds.
function sleep(ms = 0) {
  assert(Number.isInteger(ms) && ms >= 0);
  return new Promise(resolve => setTimeout(resolve, ms));
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

// Returns a response (without reading its body).
export function request_xml(url, options = {}) {
  const feed_mime_types = [
    'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
  ];

  const opts = Object.assign({}, {types: feed_mime_types}, options);
  return better_fetch(url, opts);
}

export async function fetch_feed(url, options) {
  const feed_mime_types = [
    'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
  ];

  const options = {timeout: options.timeout, types: feed_mime_types};
  const response = await better_fetch(url, options);
  const res_text = await response.text();

  const skip_entries = 'skip_entries' in options ? options.skip_entries : true;
  const resolve_entry_urls =
      'resolve_entry_urls' in options ? options.resolve_entry_urls : false;

  const parsed_feed = parse_feed(res_text, skip_entries, resolve_entry_urls);

  // Convert the feed from the parse format to the storage format
  const feed = cdb.construct_feed();
  feed.type = parsed_feed.type;

  if (parsed_feed.link) {
    let link_url;
    try {
      link_url = new URL(parsed_feed.link);
    } catch (error) {
    }

    if (link_url) {
      feed.link = link_url.href;
    }
  }

  feed.title = parsed_feed.title;
  feed.description = parsed_feed.description;
  feed.datePublished = parsed_feed.date_published || new Date();

  cdb.append_feed_url(feed, url);
  cdb.append_feed_url(feed, new URL(response.url));

  // Set the last modified date based on the response
  const last_modified_string = response.headers.get('Last-Modified');
  if (last_modified_string) {
    const last_modified_date = new Date(last_modified_string);
    if (!isNaN(last_modified_date.getTime())) {
      feed.dateLastModifed = last_modified_date;
    }
  }

  feed.dateFetched = new Date();

  const output_response = {};
  output_response.feed = feed;
  output_response.entries = parsed_feed.entries;
  output_response.http_response = response;
  return output_response;
}

// TODO: the errors used by this class should be sourced from some lower
// level shared fetch errors library

// TODO: avoid sending cookies, probably need to use fetch api and give up on
// using the simple element.src trick, it looks like HTMLImageElement does not
// allow me to control the request parameters and does send cookies, but I need
// to review this more, I am still unsure.

// @param url {URL}
// @param timeout {Number}
// @param is_allowed_request {Function} optional, is given a request-like
// object, throws a policy error if the function returns false
export async function fetch_image_element(
    url, timeout = 0, is_allowed_request) {
  assert(url instanceof URL);

  const request_data = {method: 'GET', url: url};
  if (is_allowed_request && !is_allowed_request(request_data)) {
    throw new PolicyError('Refused to fetch ' + url.href);
  }

  const fpromise = fetch_image_element_promise(url);
  const contestants = timeout ? [fpromise, sleep(timeout)] : [fpromise];
  const image = await Promise.race(contestants);

  // Image is undefined when sleep won
  if (!image) {
    throw new TimeoutError('Timed out fetching ' + url.href);
  }

  return image;
}

// Return a promise that resolves to an image element. The image is loaded by
// proxy, which in other words means that we use a new, separate image element
// attached to the same document executing this function to load the image. The
// resulting image is NOT attached to the document that contained the image that
// had the given url. The proxy is used because we cannot reliably load images
// using the HTMLImageElement src setter method if we do not know for certain
// whether the document is live or inert. Documents created by DOMParser and
// XMLHttpRequest are inert. In an inert document the src setter method does not
// work.
function fetch_image_element_promise(url, is_allowed_request) {
  return new Promise((resolve, reject) => {
    const proxy = new Image();
    proxy.src = url.href;

    // If cached then resolve immediately
    if (proxy.complete) {
      resolve(proxy);
      return;
    }

    proxy.onload = _ => resolve(proxy);

    // The error event does not contain any useful error information so create
    // our own error. Also, we create a specific error type so as to distinguish
    // this kind of error from programmer errors or other kinds of fetch errors.
    const error = new FetchError('Fetch image error ' + url.href);
    proxy.onerror = _ => reject(error);
  });
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
