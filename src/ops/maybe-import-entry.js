import {assert} from '/src/lib/assert.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import {fetch_html} from '/src/lib/fetch-html.js';
import * as sniffer from '/src/lib/sniffer.js';

export function MaybeImportEntryArgs() {
  this.entry = undefined;
  this.feed = undefined;
  this.model = undefined;
  this.iconn = undefined;
  this.rewrite_rules = [];
  this.inaccessible_descriptors = [];
  this.fetch_html_timeout = INDEFINITE;
}

// Imports the entry into the model if it does not already exist. Returns true
// if the import was successful. Returns false if the import was unsuccessful
// such as because the entry already exists. Throws various errors such as
// problems with the model database, or network errors.
export function maybe_import_entry(args) {
  assert(args instanceof MaybeImportEntryArgs);

  // Rewrite the entry's url. This is done before processing always, so there
  // no need to check whether the original url exists in the database.
  const original_url = new URL(args.entry.getURLString());
  const rewritten_url = rewrite_url(original_url, args.rewrite_rules);
  args.entry.appendURL(rewritten_url);

  // Check if the entry with the possibly rewritten url already exists
  const after_rewrite_url = new URL(args.entry.getURLString());
  let existing_entry =
      await args.model.getEntry('url', after_rewrite_url, true);
  if (existing_entry) {
    return false;
  }

  const fetch_url = new URL(args.entry.getURLString());
  const response = await fetch_entry_url(
      fetch_url, args.fetch_html_timeout, args.inaccessible_descriptors);

  if (response) {
    const response_url = new URL(response.url);
    if (net.is_redirect(fetch_url, response_url)) {
      // unfinished
    }
  }
}

function fetch_entry_url(url, timeout, inaccessible_descriptors) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return;
  }

  const sniff_class = sniffer.classify(url);
  if (sniff_class === sniffer.BINARY_CLASS) {
    return;
  }

  if (!is_accessible_url(url, inaccessible_descriptors)) {
    return;
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

// Return true unless the url matches one of the blocked urls
function is_accessible_url(url, descs) {
  for (const desc of descs) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return false;
    }
  }
  return true;
}
