import {assert, AssertionError} from '/src/assert/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline/deadline.js';
import {composite_document_filter} from '/src/dom-filters/dom-filters.js';
import * as favicon from '/src/favicon/favicon.js';
import {parse_html} from '/src/parse-html/parse-html.js';
import {Entry} from '/src/model/entry.js';
import {ConstraintError} from '/src/model/model.js';
import {fetch_html} from '/src/ops/import-entry/fetch-html.js';
import {set_base_uri} from '/src/ops/import-entry/set-base-uri.js';
import * as sniffer from '/src/ops/import-entry/url-sniffer.js';
import * as tls from '/src/tls/tls.js';

// TODO: this should not directly access tls. instead, config should provide
// tls function wrappers, and this should access config

export function ImportEntryArgs() {
  this.entry = undefined;
  this.feed = undefined;
  this.model = undefined;
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

  // TEMP: tracing new functionality
  console.debug('Importing entry', entry.getURLString());

  // Rewrite the entry's url. This is always done before processing, so there
  // no need to check whether the original url exists in the database.
  const original_url = new URL(entry.getURLString());
  const rewritten_url = rewrite_url(original_url, args.rewrite_rules);
  entry.appendURL(rewritten_url);

  // Check if the entry with the possibly rewritten url already exists
  const after_rewrite_url = new URL(entry.getURLString());
  const existing_entry =
      await args.model.getEntry('url', after_rewrite_url, true);
  if (existing_entry) {
    const message =
        'The entry with url ' + after_rewrite_url.href + ' already exists.';
    throw new ConstraintError(message);
  }

  // Fetch the entry's full content. Rethrow any errors.
  const fetch_url = new URL(entry.getURLString());
  const response = await fetch_entry_html(
      fetch_url, args.fetch_html_timeout, args.inaccessible_descriptors);

  // Handle redirection
  if (response) {
    const response_url = new URL(response.url);
    if (fetch_url.href !== response_url.href) {
      entry.appendURL(response_url);
      const rewritten_url = rewrite_url(response_url, args.rewrite_rules);
      entry.appendURL(rewritten_url);
      const existing_entry = args.model.getEntry('url', rewritten_url, true);
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
  set_base_uri(doc, new URL(entry.getURLString()));

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

  Entry.sanitize(entry);
  Entry.validate(entry);
  const new_entry_id = await args.model.createEntry(entry);
  return new_entry_id;
}

async function set_entry_favicon(entry, conn, doc) {
  const request = new favicon.LookupRequest();
  request.url = new URL(entry.getURLString());
  request.conn = conn;
  request.document = doc;
  const icon_url = await favicon.lookup(request);
  if (icon_url) {
    entry.faviconURLString = icon_url.href;
  }
}

async function filter_entry_content(entry, doc) {
  // Filter the document content
  const options = {};
  options.contrast_matte = tls.read_int('contrast_default_matte');
  options.contrast_ratio = tls.read_float('min_contrast_ratio');

  const set_image_dimensions_timeout = tls.read_int('set_image_sizes_timeout');
  if (!isNaN(set_image_dimensions_timeout)) {
    options.image_size_timeout = new Deadline(set_image_dimensions_timeout);
  }

  options.table_scan_max_rows = tls.read_int('table_scan_max_rows');

  const emphasis_max_length = tls.read_int('emphasis_max_length');
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

  return fetch_html(url, {timeout: timeout});
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
