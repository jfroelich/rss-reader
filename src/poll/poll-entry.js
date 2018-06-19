import {assert} from '/src/assert/assert.js';
import {inaccessible_content_descriptors} from '/src/config.js';
import * as db from '/src/db/db.js';
import {set_document_base_uri} from '/src/dom/set-document-base-uri.js';
import * as favicon from '/src/favicon/favicon.js';
import {parse_html} from '/src/html/parse-html.js';
import * as array from '/src/lang/array.js';
import {fetch_html} from '/src/net/fetch-html.js';
import * as sniff from '/src/net/sniff.js';
import {url_did_change} from '/src/net/url-did-change.js';
import {sanitize_document} from '/src/poll/sanitize-document.js';
import {rewrite_url} from '/src/rewrite-url/rewrite-url.js';

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
  assert(db.is_entry(entry));

  // Rewrite the entry's last url and append its new url if different.
  let url = new URL(array.peek(entry.urls));
  db.append_entry_url(entry, rewrite_url(url, rewrite_rules));

  // Check whether the entry exists. Note we skip over checking the original
  // url and only check the rewritten url, because we always rewrite before
  // storage, and that is sufficient to detect a duplicate. We get the
  // tail url a second time because it may have changed in rewriting.
  url = new URL(array.peek(entry.urls));
  const get_entry_mode = 'url', get_entry_key_only = true;
  let existing_entry =
      await db.get_entry(rconn, get_entry_mode, url, get_entry_key_only);
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
      db.append_entry_url(entry, response_url);
      db.append_entry_url(entry, rewrite_url(response_url, rewrite_rules));
      url = new URL(array.peek(entry.urls));

      existing_entry =
          await db.get_entry(rconn, get_entry_mode, url, get_entry_key_only);
      if (existing_entry) {
        throw new EntryExistsError(
            'Entry exists for redirected url ' + url.href);
      }
    }

    let response_text;
    try {
      response_text = await response.text();
      document = parse_html(response_text);
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
      document = parse_html(entry.content);
    } catch (error) {
      document = window.document.implementation.createHTMLDocument();
      document.documentElement.innerHTML = 'Invalid html content';
    }
  }


  assert(document);

  await update_entry_icon(iconn, entry, document);
  set_document_base_uri(document, url);
  await sanitize_document(document);
  entry.content = document.documentElement.outerHTML;

  assert(db.is_valid_entry(entry));
  entry = db.sanitize_entry(entry);
  return await db.update_entry(rconn, channel, entry);
}

function url_is_inaccessible_content(url) {
  for (const desc of inaccessible_content_descriptors) {
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
