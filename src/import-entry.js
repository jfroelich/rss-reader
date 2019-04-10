import assert from '/lib/assert.js';
import {INDEFINITE} from '/lib/deadline.js';
import {composite_document_filter} from '/lib/dom-filters/dom-filters.js';
import * as favicon from '/lib/favicon.js';
import fetch_html from '/lib/fetch-html.js';
import parse_html from '/lib/parse-html.js';
import set_base_uri from '/lib/set-base-uri.js';
import * as url_sniffer from '/lib/url-sniffer.js';
import * as db from '/src/db/db.js';

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

  console.debug('Importing entry', entry);

  // Rewrite the entry's url. This is always done before processing, so there
  // no need to check whether the original url exists in the database.
  const original_url = db.get_url(entry);
  const rewritten_url = rewrite_url(original_url, args.rewrite_rules);
  db.set_url(entry, rewritten_url);

  // Check if the entry with the possibly rewritten url already exists
  const after_rewrite_url = db.get_url(entry);
  const existing_entry = await db.get_resource(
      {conn: args.conn, mode: 'url', url: after_rewrite_url, key_only: true});
  if (existing_entry) {
    const message =
        'The entry with url ' + after_rewrite_url.href + ' already exists.';
    throw new db.errors.ConstraintError(message);
  }

  // Fetch the entry's full content. Rethrow any errors.
  const fetch_url = db.get_url(entry);
  const response = await fetch_entry_html(
      fetch_url, args.fetch_html_timeout, args.inaccessible_descriptors);

  // Handle redirection
  if (response) {
    const response_url = new URL(response.url);
    if (fetch_url.href !== response_url.href) {
      db.set_url(entry, response_url);

      const rewritten_url = rewrite_url(response_url, args.rewrite_rules);
      db.set_url(entry, rewritten_url);

      const existing_entry = db.get_resource(
          {conn: args.conn, mode: 'url', url: rewritten_url, key_only: true});
      if (existing_entry) {
        const message =
            'The entry with url ' + rewritten_url.href + ' already exists.';
        throw new db.errors.ConstraintError(message);
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
  set_base_uri(doc, db.get_url(entry));

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

  await composite_document_filter(doc, args.filter_options);
  entry.content = doc.documentElement.outerHTML;

  entry.type = 'entry';
  return await db.create_resource(args.conn, entry);
}

async function set_entry_favicon(entry, conn, doc) {
  const request = new favicon.LookupRequest();
  request.url = db.get_url(entry);
  request.conn = conn;
  request.document = doc;
  const icon_url = await favicon.lookup(request);
  if (icon_url) {
    entry.favicon_url = icon_url.href;
  }
}

function fetch_entry_html(url, timeout, inaccessible_descriptors) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return;
  }

  const sniff_class = url_sniffer.classify(url);
  if (sniff_class === url_sniffer.BINARY_CLASS) {
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