import {assert, AssertionError} from '/src/base/assert.js';
import * as cache from '/src/base/favicon/cache.js';
import {fetch_image} from '/src/base/favicon/http-head-image.js';

// TODO: implement tests, DO NOT USE UNTIL TESTED

// Provides favicon lookup functionality. Given a url, find the url of the
// corresponding favicon. Not spec compliant (does not always check document
// first, uses host-wide favicon regardless of page icon sometimes).

const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_MAX_FAILURE_COUNT = 3;

export {clear, compact, open} from '/src/base/favicon/cache.js';

export function LookupRequest() {
  this.url = undefined;
  this.document = undefined;
  this.conn = undefined;
  this.fetch_image_timeout = 0;
  this.min_image_size = 30;
  this.max_image_size = 10240;
  this.max_failure_count = DEFAULT_MAX_FAILURE_COUNT;
}

export async function lookup(request) {
  assert(is_valid_lookup_request(request));

  const conn = request.conn;
  const hostname = request.url.hostname;

  let entry = await cache.find_entry(conn, hostname);

  if (entry && entry.icon_url && !entry_is_expired(entry)) {
    console.debug('Hit valid', hostname, entry.icon_url);
    return entry.icon_url;
  }

  if (entry && entry.failures > request.max_failure_count) {
    console.debug('Hit but invalid', hostname);
    return;
  }

  const icon_url = search_document(request.document);
  if (icon_url) {
    console.debug('Found favicon in document', icon_url);
    const entry = new cache.Entry();
    entry.hostname = hostname;
    entry.icon_url = icon_url;
    const now = new Date();
    entry.expires = new Date(Date.now() + ONE_MONTH_MS);
    entry.failures = 0;

    await cache.put_entry(conn, entry);
    return icon_url;
  }

  let response;
  try {
    response = await fetch_root_icon(request);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    } else {
      // Ignore
    }
  }


  if (response) {
    console.debug('Found root icon', hostname, response.url);
    const entry = new cache.Entry();
    entry.hostname = hostname;
    entry.icon_url = response.url;
    const now = new Date();
    entry.expires = new Date(Date.now() + ONE_MONTH_MS);
    entry.failures = 0;
    await cache.put_entry(conn, entry);
    return response.url;
  }

  // Memoize a failed lookup
  console.debug(
      'lookup failed', hostname, entry.failures ? entry.failures + 1 : 1);
  const failure = new cache.Entry();
  failure.hostname = hostname;
  failure.failures = entry && entry.failures ? entry.failures + 1 : 1;
  failure.icon_url = entry ? entry.icon_url : undefined;
  const now = new Date();
  failure.expires = new Date(now.getTime() + 2 * ONE_MONTH_MS);
  await cache.put_entry(conn, failure);
}

// Fetch /favicon.ico
async function fetch_root_icon(request) {
  const url = request.url;
  const min_size = request.min_image_size;
  const max_size = request.max_image_size;
  const timeout = request.fetch_image_timeout;

  const root_icon = new URL(url.origin + '/favicon.ico');

  const fetch_options = {method: 'head', timeout: timeout};

  // Call without catching errors
  const response = await fetch_image(root_icon, fetch_options);

  const content_length = response.headers.get('Content-Length');
  if (content_length) {
    const length = parseInt(content_length, 10);
    if (!isNaN(length)) {
      if (length < min_size || length > max_size) {
        throw new RangeError('Image byte size out of range ' + root_icon.href);
      }
    }
  }

  return response;
}

function search_document(document) {
  if (!document) {
    return;
  }

  if (!document.head) {
    return;
  }

  const selector = [
    'link[rel="icon"][href]', 'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');

  const links = document.head.querySelectorAll(selector);

  // Assume the document has a valid baseURI. Although we are not even using
  // that at the moment, for now we just trust the href is canonical (and a
  // defined string)
  if (links.length > 1) {
    return links[0].getAttribute('href');
  }
}

function entry_is_expired(entry) {
  return entry.expires && entry.expires <= new Date();
}

function is_valid_lookup_request(request) {
  if (!(request instanceof LookupRequest)) {
    return false;
  }

  if (request.conn && !(request.conn instanceof IDBDatabase)) {
    return false;
  }

  if (!(request.url instanceof URL)) {
    return false;
  }

  return true;
}

export class RangeError extends Error {}
