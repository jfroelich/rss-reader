import * as favicon from '/src/action/favicon/favicon.js';
import {sanitize_document} from '/src/action/poll/sanitize-document.js';
import * as array from '/src/lib/array.js';
import assert from '/src/lib/assert.js';
import {set_base_uri} from '/src/lib/html-document.js';
import * as html from '/src/lib/html.js';
import * as ls from '/src/lib/ls.js';
import {fetch_html} from '/src/lib/net/fetch-html.js';
import * as sniff from '/src/lib/net/sniff.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import {ModelAccess} from '/src/model/model-access.js';
import * as sanity from '/src/model/model-sanity.js';
import * as Model from '/src/model/model.js';

export class EntryExistsError extends Error {
  constructor(message = 'Entry already exists') {
    super(message);
  }
}

// Processes an entry and possibly adds it to the database. Attempts to fetch
// the full text of the entry. Either returns the added entry id, or throws an
// error.
export async function poll_entry(
    rconn, iconn, channel, entry, fetch_html_timeout, fetch_image_timeout,
    rewrite_rules) {
  assert(Model.is_entry(entry));

  // TODO: should be passing around ma instance instead of separate params and
  // recreating the instance here
  const ma = new ModelAccess();
  ma.conn = rconn;
  ma.channel = channel;

  // Rewrite the entry's last url and append its new url if different.
  let url = new URL(array.peek(entry.urls));
  Model.append_entry_url(entry, rewrite_url(url, rewrite_rules));

  // Check whether the entry exists. Note we skip over checking the original
  // url and only check the rewritten url, because we always rewrite before
  // storage, and that is sufficient to detect a duplicate. We get the
  // tail url a second time because it may have changed in rewriting.
  url = new URL(array.peek(entry.urls));
  const get_mode = 'url', key_only = true;
  let existing_entry = await ma.getEntry(get_mode, url, key_only);
  if (existing_entry) {
    throw new EntryExistsError('Entry already exists for url ' + url.href);
  }

  // Fetch the entry full text. Reuse the url from above since it has not
  // changed. Trap fetch errors so that we can fall back to using feed content
  let response;
  if ((url.protocol === 'http:' || url.protocol === 'https:') &&
      sniff.classify(url) !== sniff.BINARY_CLASS &&
      !url_is_inaccessible_content(url)) {
    try {
      response = await fetch_html(url, fetch_html_timeout);
    } catch (error) {
    }
  }

  // If we fetched and redirected, append the post-redirect response url, and
  // reapply url rewriting.
  let document;
  if (response) {
    let url_changed = false;
    const response_url = new URL(response.url);
    if (url_did_change(url, response_url)) {
      url_changed = true;
      Model.append_entry_url(entry, response_url);
      Model.append_entry_url(entry, rewrite_url(response_url, rewrite_rules));
      url = new URL(array.peek(entry.urls));
      existing_entry = await ma.getEntry(get_mode, url, key_only);
      if (existing_entry) {
        throw new EntryExistsError(
            'Entry exists for redirected url ' + url.href);
      }
    }

    let response_text;
    try {
      response_text = await response.text();
      document = html.parse_html(response_text);
    } catch (error) {
    }

    if (document && !entry.title) {
      const title_element = document.querySelector('html > head > title');
      if (title_element) {
        entry.title = title_element.textContent;
      }
    }

  } else {
    try {
      document = html.parse_html(entry.content);
    } catch (error) {
      document = window.document.implementation.createHTMLDocument();
      document.documentElement.innerHTML = 'Invalid html content';
    }
  }

  assert(document);

  await update_entry_icon(iconn, entry, document);
  set_base_uri(document, url);
  await sanitize_document(document);
  entry.content = document.documentElement.outerHTML;

  // Cleanup the entry properties
  sanity.sanitize_entry(entry);
  // Throw a validation error if invalid
  sanity.validate_entry(entry);
  return await ma.createEntry(entry);
}

// TODO: somehow store in configuration instead of here, look into
// deserializing using Regex constructor or something
const inaccessible_content_descriptors = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com$/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com$/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /wsj\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];

function url_is_inaccessible_content(url) {
  const descs = inaccessible_content_descriptors;
  for (const desc of descs) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

async function update_entry_icon(iconn, entry, document) {
  const lookup_url = new URL(array.peek(entry.urls));
  const fetch = false;
  const icon_url_string =
      await favicon.lookup(iconn, lookup_url, document, fetch);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
}
