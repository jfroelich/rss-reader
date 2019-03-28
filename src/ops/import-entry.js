import * as config from '/src/config.js';
import Entry from '/src/db/entry.js';
import {ConstraintError} from '/src/db/errors.js';
import * as locatable from '/src/db/locatable.js';
import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import validate_entry from '/src/db/ops/validate-entry.js';
import assert from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import {composite_document_filter} from '/src/lib/dom-filters/dom-filters.js';
import * as favicon from '/src/lib/favicon.js';
import fetch_html from '/src/lib/fetch-html.js';
import parse_html from '/src/lib/parse-html.js';
import set_base_uri from '/src/lib/set-base-uri.js';
import * as sniffer from '/src/lib/url-sniffer.js';

export function ImportEntryArgs() {
  this.entry = undefined;
  this.feed = undefined;
  this.conn = undefined;
  this.iconn = undefined;
  this.rewrite_rules = [];
  this.inaccessible_descriptors = [];
  this.fetch_html_timeout = INDEFINITE;
}

// Imports the entry into the model if it does not already exist. Returns
// undefined if the entry exists. Returns the new entry's id if the entry was
// added.
export async function import_entry(args) {
  const entry = args.entry;

  // Rewrite the entry's url. This is always done before processing, so there
  // no need to check whether the original url exists in the database.
  const original_url = locatable.get_url(entry);
  const rewritten_url = rewrite_url(original_url, args.rewrite_rules);
  locatable.append_url(entry, rewritten_url);

  // Check if the entry with the possibly rewritten url already exists
  const after_rewrite_url = locatable.get_url(entry);
  const existing_entry =
      await get_entry(args.conn, 'url', after_rewrite_url, true);
  if (existing_entry) {
    const message =
        'The entry with url ' + after_rewrite_url.href + ' already exists.';
    throw new ConstraintError(message);
  }

  // Fetch the entry's full content. Rethrow any errors.
  const fetch_url = locatable.get_url(entry);
  const response = await fetch_entry_html(
      fetch_url, args.fetch_html_timeout, args.inaccessible_descriptors);

  // Handle redirection
  if (response) {
    const response_url = new URL(response.url);
    if (fetch_url.href !== response_url.href) {
      locatable.append_url(entry, response_url);

      const rewritten_url = rewrite_url(response_url, args.rewrite_rules);
      locatable.append_url(entry, rewritten_url);

      const existing_entry = get_entry(args.conn, 'url', rewritten_url, true);
      if (existing_entry) {
        const message =
            'The entry with url ' + rewritten_url.href + ' already exists.';
        throw new ConstraintError(message);
      }
    }
  }

  // Get the full text as a Document. Favor the fetched full text over the
  // in-feed-xml summary. We do this before the favicon lookup so as to provide
  // favicon lookup the ability to inspect the document header.
  let doc;
  if (response) {
    const full_text = await response.text();
    doc = parse_html(full_text);
  } else {
    doc = parse_html(entry.content || '');
  }

  // This must occur before doing favicon lookups because the lookup may inspect
  // the document and expects DOM element property getters like image.src to
  // have the proper base uri set.
  set_base_uri(doc, locatable.get_url(entry));

  if (args.iconn) {
    // Only provide if doc came from remote. If it came from feed-xml then it
    // will not have embedded favicon link.
    const lookup_doc = response ? doc : undefined;
    await set_entry_favicon(entry, args.iconn, lookup_doc);
  }

  // If title was not present in the feed xml, try and pull it from fetched
  // content
  if (!entry.title && response && doc) {
    const title_element = doc.querySelector('html > head > title');
    if (title_element) {
      entry.title = title_element.textContent.trim();
    }
  }

  await filter_entry_content(entry, doc);

  sanitize_entry(entry);
  validate_entry(entry);
  const new_entry_id = await create_entry(args.conn, entry);
  return new_entry_id;
}

async function set_entry_favicon(entry, conn, doc) {
  const request = new favicon.LookupRequest();
  request.url = locatable.get_url(entry);
  request.conn = conn;
  request.document = doc;
  const icon_url = await favicon.lookup(request);
  if (icon_url) {
    entry.favicon_url = icon_url.href;
  }
}

async function filter_entry_content(entry, doc) {
  // Filter the document content
  const options = {};
  options.contrast_matte = config.read_int('contrast_default_matte');
  options.contrast_ratio = config.read_float('min_contrast_ratio');

  const set_image_dimensions_timeout =
      config.read_int('set_image_sizes_timeout');
  if (!isNaN(set_image_dimensions_timeout)) {
    options.image_size_timeout = new Deadline(set_image_dimensions_timeout);
  }

  options.table_scan_max_rows = config.read_int('table_scan_max_rows');

  const emphasis_max_length = config.read_int('emphasis_max_length');
  if (!isNaN(emphasis_max_length)) {
    options.emphasis_max_length = emphasis_max_length;
  }

  options.empty_frame_body_message =
      'Unable to display document because it uses HTML frames';

  await composite_document_filter(doc, options);
  entry.content = doc.documentElement.outerHTML;
}

function fetch_entry_html(url, timeout, inaccessible_descriptors) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return;
  }

  const sniff_class = sniffer.classify(url);
  if (sniff_class === sniffer.BINARY_CLASS) {
    return;
  }

  // Avoid fetching if url matches one of the descriptors
  for (const desc of inaccessible_descriptors) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return;
    }
  }

  const fetch_options = {};
  fetch_options.timeout = timeout;
  // allow for text/plain as web page mime type
  fetch_options.allow_text = true;

  return fetch_html(url, fetch_options);
}

export function rewrite_url(url, rules) {
  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }
  return next;
}
