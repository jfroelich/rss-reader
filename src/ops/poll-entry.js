import * as color from '/src/lib/color.js';
import * as html_parser from '/src/lib/html-parser.js';
import {list_empty, list_peek} from '/src/lib/list.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import * as sniff from '/src/lib/sniff.js';
import * as url_loader from '/src/lib/url-loader.js';
import {entry_append_url} from '/src/objects/entry.js';
import {contains_entry} from '/src/ops/contains-entry.js';
import {fetch_html} from '/src/ops/fetch.js';
import {lookup_icon} from '/src/ops/lookup-icon.js';
import {transform_document} from '/src/ops/transform-document.js';
import {write_entry} from '/src/ops/write-entry.js';

const rewrite_rules = build_rewrite_rules();

const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'}
];

export async function poll_entry(entry) {
  if (list_empty(entry.urls)) {
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

  const op = {};
  op.conn = this.rconn;
  op.channel = this.channel;
  op.console = this.console;
  op.write_entry = write_entry;

  const validate = true;
  const stored_entry = await op.write_entry(entry, validate);
  return stored_entry.id;
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

  entry_append_url(entry, response_url);
  entry_rewrite_tail_url(entry, rewrite_rules);
  return await entry_exists(rconn, entry);
}

function entry_rewrite_tail_url(entry, rewrite_rules) {
  const tail_url = new URL(list_peek(entry.urls));
  const new_url = rewrite_url(tail_url, rewrite_rules);
  if (!new_url) {
    return false;
  }
  return entry_append_url(entry, new_url);
}

async function entry_exists(rconn, entry) {
  const url = new URL(list_peek(entry.urls));
  const query = {url: url};
  return await contains_entry(rconn, query);
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
  op.lookup_icon = lookup_icon;

  const fetch = false;
  const icon_url_string = await op.lookup_icon(lookup_url, document, fetch);
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
