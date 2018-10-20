import assert from '/src/base/assert.js';
import * as cache from '/src/base/favicon/cache.js';
import {check_image} from '/src/base/favicon/check-image.js';

// Provides favicon lookup functionality. Given a url, find the url of the
// corresponding favicon. Not spec compliant (does not always check document
// first, uses origin wide favicon regardless of page icon sometimes).

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
  const document = request.document;
  const origin = new URL(request.url.origin);

  let entry = await cache.find_entry(conn, origin);

  if (entry && entry.icon_url && !entry_is_expired(entry)) {
    console.debug('Hit', entry);
    return entry.icon_url;
  }

  // Exit early without error if too many failed looks against this origin
  if (entry && entry.failures > request.max_failure_count) {
    console.debug('Hit but too many failed lookups', origin.href);
    return;
  }

  // At this point we either have no entry, or an expired entry. If expired we
  // also know that it has not had too many failures

  // Check the document
  if (document) {
    const url = search_document(document);
    if (url) {
      const entry = new cache.Entry();
      entry.origin = origin.href;
      entry.icon_url = url;
      const now = new Date();
      entry.expires = new Date(Date.now() + ONE_MONTH_MS);
      entry.failures = 0;

      console.debug(
          'Found icon in document, storing new entry or replacing expired',
          entry);
      await cache.put_entry(conn, entry);
      return url;
    }
  }

  // Check for /favicon.ico and if found store an entry. This will either
  // create a new entry or replace the expired one.
  const root_icon = new URL(request.url.origin + '/favicon.ico');
  const size_constraints = {
    min: request.min_image_size,
    max: request.max_image_size
  };
  let has_root = false;
  try {
    has_root = await check_image(
        root_icon.href, size_constraints, request.fetch_image_timeout);
  } catch (error) {
    // Fetch errors are not fatal to lookup
    // TODO: well, assertion-style errors should be fatal and rethrown but how
    // do i differentiate here?
  }

  if (has_root) {
    const entry = new cache.Entry();
    entry.origin = origin.href;
    entry.icon_url = root_icon.href;
    const now = new Date();
    entry.expires = new Date(Date.now() + ONE_MONTH_MS);
    entry.failures = 0;
    console.debug(
        'Found root icon, storing new entry or replacing expired', entry);
    await cache.put_entry(conn, entry);

    return root_icon.href;
  }

  // All checks failed, record a failed lookup and return undefined
  await record_failure(origin, conn, entry);
}

function search_document(document) {
  if (!document.head) {
    return;
  }

  const selector = [
    'link[rel="icon"][href]', 'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');

  const links = document.head.querySelectorAll(selector);

  // Assume the document has a valid baseURI
  // although we are not even using that at the moment, for now we just trust
  // the href is canonical

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

function record_failure(origin, conn, entry) {
  const now = new Date();

  if (entry) {
    entry.failures++;
  } else {
    entry = new cache.Entry();
    entry.origin = origin.href;
    entry.failures = 1;
  }

  entry.expires = new Date(now.getTime() + 2 * ONE_MONTH_MS);
  return cache.put_entry(conn, entry);
}
