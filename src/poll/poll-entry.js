import {db_find_entry_id_by_url} from '/src/db/db-find-entry-id-by-url.js';
import {db_sanitize_entry} from '/src/db/db-sanitize-entry.js';
import {db_validate_entry} from '/src/db/db-validate-entry.js';
import {db_write_entry} from '/src/db/db-write-entry.js';
import {append_entry_url, is_valid_entry_id} from '/src/entry.js';
import {favicon_lookup} from '/src/favicon.js';
import {fetch_html} from '/src/fetch.js';
import * as color from '/src/lib/color.js';
import * as html_parser from '/src/lib/html-parser.js';
import {list_is_empty, list_peek} from '/src/lib/list.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import * as sniff from '/src/lib/sniff.js';
import * as url_loader from '/src/lib/url-loader.js';
import {transform_document} from '/src/poll/transform-document.js';

const rewrite_rules = build_rewrite_rules();

const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];

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
  await update_entry_icon(this.iconn, this.console, entry, document);
  await update_entry_content(
      entry, document, this.console, this.fetch_image_timeout);

  // Explicitly validate the entry. This was previously done via the call to
  // db_write_entry, and threw a type error which was not caught here. For now,
  // just throw a basic error to match the previous behavior. In the future,
  // think about whether this should be throwing an error at all or doing
  // something else.
  if (!db_validate_entry(entry)) {
    throw new Error('Invalid entry ' + entry);
  }

  // Explicitly sanitize the entry. This was previously done by db_write_entry
  // but that is no longer the case. For now, replace the parameter value with
  // itself, even though sanitize clones. Also note that sanitize now filters
  // empty properties implicitly
  entry = db_sanitize_entry(entry);

  const op = {};
  op.conn = this.rconn;
  op.channel = this.channel;
  op.console = this.console;
  op.db_write_entry = db_write_entry;
  const new_entry_id = await op.db_write_entry(entry);
  return new_entry_id;
}

async function handle_entry_redirect(rconn, entry, response, rewrite_rules) {
  if (!response) {
    return false;
  }

  const request_url = new URL(list_peek(entry.urls));
  const response_url = new URL(response.url);
  if (!url_loader.url_did_change(request_url, response_url)) {
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
  const op = {conn: rconn, db_find_entry_id_by_url: db_find_entry_id_by_url};
  const id = await op.db_find_entry_id_by_url(url);
  return is_valid_entry_id(id);
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
  for (const desc of INACCESSIBLE_CONTENT_DESCRIPTORS) {
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
    return html_parser.parse(response_text);
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

async function update_entry_icon(iconn, console, entry, document) {
  const lookup_url = new URL(list_peek(entry.urls));

  const op = {};
  op.conn = iconn;
  op.console = console;
  op.favicon_lookup = favicon_lookup;

  const fetch = false;
  const icon_url_string = await op.favicon_lookup(lookup_url, document, fetch);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
}

async function update_entry_content(
    entry, document, console, fetch_image_timeout) {
  if (!document) {
    try {
      document = html_parser.parse(entry.content);
    } catch (error) {
      entry.content = 'Bad formatting (unsafe HTML redacted)';
      return;
    }
  }

  const document_url = new URL(list_peek(entry.urls));
  const opts = {
    fetch_image_timeout: fetch_image_timeout,
    matte: color.WHITE,
    min_contrast_ratio: localStorage.MIN_CONTRAST_RATIO,
    emphasis_length_max: 200
  };

  await transform_document(document, document_url, console, opts);
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
