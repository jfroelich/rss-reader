import {inaccessible_content_descriptors} from '/src/config.js';
import {append_entry_url, is_valid_entry_id} from '/src/entry.js';
import {favicon_lookup} from '/src/favicon.js';
import {fetch_html} from '/src/fetch.js';
import {set_document_base_uri} from '/src/lib/dom/set-document-base-uri.js';
import {parse_html} from '/src/lib/html/parse-html.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';
import * as sniff from '/src/lib/net/sniff.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import {log} from '/src/log.js';
import {get_entry, sanitize_entry, update_entry, is_valid_entry} from '/src/reader-db.js';
import {sanitize_document} from '/src/sanitize-document.js';

// Processes an entry and possibly adds it to the database. The full-text html
// of the entry is fetched and stored as `entry.content`.

// ### Context properties
// * **rconn** {IDBDatabase} required
// * **iconn** {IDBDatabase} required
// * **channel** {BroadcastChannel} required
// * **fetch_html_timeout** {Number} optional
// * **fetch_image_timeout** {Number} optional

// ### Params
// * **entry** {object}

// ### Misc implementation notes
// * url rewriting always occurs before checking whether a url exists. The
// original url is not checked. This reduces the number of checks that must
// occur.

const rewrite_rules = build_rewrite_rules();

export async function poll_entry(entry) {
  if (list_is_empty(entry.urls)) {
    return;
  }

  entry_rewrite_tail_url(entry, rewrite_rules);
  if (await entry_exists(this.rconn, entry)) {
    return;
  }

  const response = await fetch_entry(entry, this.fetch_html_timeout);
  if (await handle_entry_redirect(this.rconn, entry, response, rewrite_rules)) {
    return;
  }

  const document = await parse_response(response);
  update_entry_title(entry, document);
  await update_entry_icon(this.iconn, entry, document);
  await update_entry_content(entry, document, this.fetch_image_timeout);

  // Explicitly validate the entry. This was previously done via the call to
  // update_entry, and threw a type error which was not caught here. For now,
  // just throw a basic error to match the previous behavior. In the future,
  // think about whether this should be throwing an error at all or doing
  // something else.
  if (!is_valid_entry(entry)) {
    throw new Error('Invalid entry ' + entry);
  }

  // Explicitly sanitize the entry. This was previously done by update_entry
  // but that is no longer the case. For now, replace the parameter value with
  // itself, even though sanitize clones. Also note that sanitize now filters
  // empty properties implicitly
  entry = sanitize_entry(entry);

  const op = {};
  op.conn = this.rconn;
  op.channel = this.channel;
  op.update_entry = update_entry;
  const new_entry_id = await op.update_entry(entry);
  return new_entry_id;
}

async function handle_entry_redirect(rconn, entry, response, rewrite_rules) {
  if (!response) {
    return false;
  }

  const request_url = new URL(list_peek(entry.urls));
  const response_url = new URL(response.url);
  if (!url_did_change(request_url, response_url)) {
    return false;
  }

  append_entry_url(entry, response_url);
  entry_rewrite_tail_url(entry, rewrite_rules);
  return await entry_exists(rconn, entry);
}

function entry_rewrite_tail_url(entry, rewrite_rules) {
  const tail_url = new URL(list_peek(entry.urls));
  const new_url = rewrite_url(tail_url, rewrite_rules);
  if (!new_url) {
    return false;
  }
  return append_entry_url(entry, new_url);
}

async function entry_exists(rconn, entry) {
  const url = new URL(list_peek(entry.urls));
  const mode_url = 'url', key_only = true;
  const existing_entry = await get_entry(rconn, mode_url, url, key_only);
  return existing_entry ? true : false;
}

// TODO: i think this should always return a response, so instead of returning
// undefined if not augmentable, return a stub error promise
// TODO: undecided, but maybe augmentability is not this function's concern?
async function fetch_entry(entry, fetch_html_timeout) {
  const url = new URL(list_peek(entry.urls));
  if (url_is_augmentable(url)) {
    const response = await fetch_html(url, fetch_html_timeout);
    if (response.ok) {
      return response;
    }
  }
}

function url_is_augmentable(url) {
  return url_is_http(url) && sniff.classify(url) !== sniff.BINARY_CLASS &&
      !url_is_inaccessible_content(url);
}

function url_is_inaccessible_content(url) {
  for (const desc of inaccessible_content_descriptors) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function url_is_http(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

async function parse_response(response) {
  if (!response) {
    return;
  }

  const response_text = await response.text();

  try {
    return parse_html(response_text);
  } catch (error) {
  }
}

function update_entry_title(entry, document) {
  if (document && !entry.title) {
    const title_element = document.querySelector('html > head > title');
    if (title_element) {
      entry.title = title_element.textContent;
    }
  }
}

async function update_entry_icon(iconn, entry, document) {
  const lookup_url = new URL(list_peek(entry.urls));

  const op = {};
  op.conn = iconn;
  op.favicon_lookup = favicon_lookup;

  const fetch = false;
  const icon_url_string = await op.favicon_lookup(lookup_url, document, fetch);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
}

async function update_entry_content(entry, document, fetch_image_timeout) {
  if (!document) {
    try {
      document = parse_html(entry.content);
    } catch (error) {
      entry.content = 'Bad formatting (unsafe HTML redacted)';
      return;
    }
  }

  // sanitize_document requires the document have document.baseURI set.
  const document_url = new URL(list_peek(entry.urls));
  set_document_base_uri(document, document_url);


  await sanitize_document(document);
  entry.content = document.documentElement.outerHTML;
}

function build_rewrite_rules() {
  const rules = [];
  rules.push(google_news_rule);
  rules.push(techcrunch_rule);
  rules.push(facebook_exit_rule);
  return rules;
}

function google_news_rule(url) {
  if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
    const param = url.searchParams.get('url');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}

function techcrunch_rule(url) {
  if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
    const output = new URL(url.href);
    output.searchParams.delete('ncid');
    return output;
  }
}

function facebook_exit_rule(url) {
  if (url.hostname === 'l.facebook.com' && url.pathname === '/l.php') {
    const param = url.searchParams.get('u');
    try {
      return new URL(param);
    } catch (error) {
    }
  }
}
