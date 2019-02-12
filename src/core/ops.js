import * as cdb from '/src/core/cdb.js';
import * as favicon from '/src/core/favicon.js';
import * as net from '/src/core/net.js';
import * as utils from '/src/core/utils.js';
import {assert} from '/src/lib/assert.js';
import * as tls from '/src/lib/tls.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
export async function badge_refresh() {
  const session = await cdb.open();
  const count = await cdb.count_unread_entries(session);
  session.close();

  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({text: text});
}

export function activate_feed(session, feed_id) {
  const props = {};
  props.id = feed_id;
  props.active = true;
  props.deactivateDate = undefined;
  props.deactivationReasonText = undefined;
  return cdb.update_feed(session, props, false);
}

export async function deactivate_feed(session, feed_id, reason) {
  const props = {};
  props.id = feed_id;
  props.active = false;
  props.deactivateDate = new Date();
  props.deactivationReasonText = reason;
  await cdb.update_feed(session, props, false);
}

// Returns an in memory OPML document object filled with the feeds from the
// database. document_title is optional.
export async function export_opml(document_title) {
  const doc = create_opml_template(document_title);
  const session = await cdb.open();
  const feeds = await cdb.get_feeds(session, 'all', false);
  session.close();

  const outlines = feeds.map(feed => {
    const outline = {};
    outline.type = feed.type;
    if (feed.urls && feed.urls.length) {
      outline.xml_url = feed.urls[feed.urls.length - 1];
    }
    outline.title = feed.title;
    outline.description = feed.description;
    outline.html_url = feed.link;
    return outline;
  });

  const maybe_set = function(element, name, value) {
    if (value) element.setAttribute(name, value);
  };

  // The document.body shortcut is html-flagged documents only
  const body_element = doc.querySelector('body');

  for (const outline of outlines) {
    // XSS: use the xml document, not the document running this script
    const elm = doc.createElement('outline');
    maybe_set(elm, 'type', outline.type);
    maybe_set(elm, 'xmlUrl', outline.xml_url);
    maybe_set(elm, 'title', outline.title);
    maybe_set(elm, 'description', outline.description);
    maybe_set(elm, 'htmlUrl', outline.html_url);
    body_element.appendChild(elm);
  }

  return doc;
}

function create_opml_template(document_title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (document_title) {
    const title_element = doc.createElement('title');
    title_element.textContent = document_title;
  }

  const current_date = new Date();
  const current_date_utc_string = current_date.toUTCString();

  const date_created_element = doc.createElement('datecreated');
  date_created_element.textContent = current_date_utc_string;
  head_element.appendChild(date_created_element);

  const date_modified_element = doc.createElement('datemodified');
  date_modified_element.textContent = current_date_utc_string;
  head_element.appendChild(date_modified_element);

  const docs_element = doc.createElement('docs');
  docs_element.textContent = 'http://dev.opml.org/spec2.html';
  head_element.appendChild(docs_element);

  const body_element = doc.createElement('body');
  doc.documentElement.appendChild(body_element);
  return doc;
}

// Create and store feed objects in the database based on urls extracted from
// zero or more opml files. |files| should be a FileList or an Array.
export async function opml_import(session, files) {
  // TODO: stricter guard
  assert(files);
  console.log('Importing %d OPML files', files.length);

  // Grab urls from each of the files. Per-file errors are logged not thrown.
  const promises = Array.prototype.map.call(files, file => {
    const promise = opml_import_read_feeds(file);
    return promise.catch(console.warn);
  });
  const results = await Promise.all(promises);

  // Flatten results into a simple array of urls
  const urls = [];
  for (const result of results) {
    if (result) {
      for (const url of result) {
        urls.push(url);
      }
    }
  }

  // Filter dups
  // TODO: can Array.prototype.indexOf/includes work on URL objects? It is
  // comparison by reference?
  const url_set = [], seen_hrefs = [];
  for (const url of urls) {
    if (!seen_hrefs.includes(url.href)) {
      url_set.push(url);
      seen_hrefs.push(url.href);
    }
  }

  // Convert urls into feeds
  const feeds = url_set.map(url => {
    const feed = new cdb.Feed();
    feed.appendURL(url);
    return feed;
  });

  return cdb.create_feeds(session, feeds);
}

async function opml_import_read_feeds(file) {
  // TODO: this is user input, not programmer input, because we do not want to
  // place the burden on the caller to provide the correct file type. Therefore
  // this should just log a warning and return an empty array?
  // TODO: maybe we should not be trying to consider the mime type at all, and
  // just allow the parsing to fail later.
  if (!file_type_is_opml(file)) {
    const msg = 'Unacceptable type ' + file.type + ' for file ' + file.name;
    throw new TypeError(msg);
  }

  if (!file.size) {
    return [];
  }

  const file_text = await utils.file_read_text(file);
  const document = parse_opml(file_text);

  const elements = document.querySelectorAll('opml > body > outline[type]');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const url_string = element.getAttribute('xmlUrl');
      const url = opml_import_parse_url_noexcept(url_string);
      if (url) {
        urls.push(url);
      }
    }
  }
  return urls;
}

function opml_import_parse_url_noexcept(url_string) {
  if (url_string) {
    try {
      return new URL(url_string);
    } catch (error) {
    }
  }
}

function file_type_is_opml(file) {
  const types = [
    'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
    'application/opml+xml'
  ];
  return types.includes(file.type);
}

function parse_opml(xml_string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    const message = utils.condense_whitespace(error.textContent);
    throw new OPMLParseError(message);
  }

  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new OPMLParseError('Document element is not opml: ' + name);
  }
  return document;
}

export class OPMLParseError extends Error {
  constructor(message = 'Parsing error') {
    super(message);
  }
}

export async function subscribe(session, iconn, url, timeout, notify) {
  // Check if subscribed to the input url
  let existing_feed = await cdb.get_feed(session, 'url', url, true);
  if (existing_feed) {
    const message = 'Found existing feed with url ' + url.href;
    throw new ConstraintError(message);
  }

  // Propagate fetch errors as subscribe errors
  const fetch_options = {
    timeout: timeout,
    skip_entries: true,
    resolve_entry_urls: false
  };
  const response = await net.fetch_feed(url, fetch_options);
  const http_response = response.http_response;

  // If redirected, check if subscribed to the redirected url
  if (net.response_is_redirect(url, http_response)) {
    const rurl = new URL(http_response.url);
    let existing_feed = await cdb.get_feed(session, 'url', rurl, true);
    if (existing_feed) {
      const message = 'Found existing feed with redirect url ' + rurl.href;
      throw new ConstraintError(message);
    }
  }

  const feed = response.feed;

  // TODO: inline the helper here now that subscribe is within ops so as to
  // reduce the number of global helpers that relate to only one use context
  await set_feed_favicon(iconn, feed);


  cdb.validate_feed(feed);
  cdb.sanitize_feed(feed);
  feed.id = await cdb.create_feed(session, feed);

  if (notify) {
    // TODO: use cdb.getFeedURLString
    const feed_title = feed.title || feed.urls[feed.urls.length - 1];
    const note = {};
    note.title = 'Subscribed!';
    note.message = 'Subscribed to ' + feed_title;
    note.url = feed.faviconURLString;
    utils.show_notification(tls, note);
  }

  return feed;
}

export function unsubscribe(session, feed_id) {
  return cdb.delete_feed(session, feed_id, 'unsubscribe');
}

async function set_feed_favicon(iconn, feed) {
  if (!iconn) {
    return;
  }

  const lookup_url = get_feed_favicon_lookup_url(feed);
  const request = new favicon.LookupRequest();
  request.url = lookup_url;
  feed.faviconURLString = await favicon.lookup(request);
}

// Create the url to use for lookups given a database feed object
export function get_feed_favicon_lookup_url(feed) {
  if (feed.link) {
    return new URL(feed.link);
  }

  if (!feed.urls) {
    return;
  }

  if (!feed.urls.length) {
    return;
  }

  const url_string = feed.urls[feed.urls.length - 1];
  if (!url_string) {
    return;
  }

  // Throw if url_string is invalid or relative
  const tail_url = new URL(url_string);
  return new URL(tail_url.origin);
}

export async function refresh_feed_icons(session, iconn) {
  const feeds = await cdb.get_feeds(session, 'active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(session, iconn, feed));
  }
  return Promise.all(promises);
}

// Update the favicon of a feed in the database
async function refresh_feed_icon(session, iconn, feed) {
  if (!feed.urls || !feed.urls.length) {
    return;
  }

  const lookup_url = get_feed_favicon_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  const request = new favicon.LookupRequest();
  request.conn = iconn;
  request.url = lookup_url;
  const icon_url_string = await favicon.lookup(request);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    await cdb.update_feed(session, feed, true);
  }
}

export class ConstraintError extends Error {
  constructor(message) {
    super(message);
  }
}
