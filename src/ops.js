import * as cdb from '/src/cdb.js';
import * as favicon from '/src/favicon.js';
import * as net from '/src/net.js';
import * as note from '/src/note.js';
import * as utils from '/src/utils.js';

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

export async function opml_import(session, files) {
  const read_files_results = await opml_import_read_files(files);
  const url_array = opml_import_flatten_urls(read_files_results);
  const url_array_set = opml_import_dedup_urls(url_array);

  const feeds = url_array_set.map(url => {
    const feed = cdb.construct_feed();
    cdb.append_feed_url(feed, url);
    return feed;
  });

  return cdb.create_feeds(session, feeds);
}

function opml_import_read_files(files) {
  const promises = files.map(file => {
    const promise = opml_import_read_feeds(file);
    // Redirect per-file errors to console rather than exceptions
    return promise.catch(console.warn);
  });
  return Promise.all(promises);
}

function opml_import_flatten_urls(all_files_urls) {
  // per_file_urls may be undefined if there was a problem reading the file
  // that generated it
  const urls = [];
  for (const per_file_urls of all_files_urls) {
    if (per_file_urls) {
      for (const url of per_file_urls) {
        urls.push(url);
      }
    }
  }
  return urls;
}

async function opml_import_read_feeds(file) {
  if (!file_is_opml(file)) {
    const msg = 'Unacceptable type ' + file.type + ' for file ' + file.name;
    throw new TypeError(msg);
  }

  if (!file.size) {
    return [];
  }

  const file_text = await utils.file_read_text(file);
  const document = parse_opml(file_text);
  return opml_import_find_urls(document);
}

function opml_import_dedup_urls(urls) {
  const url_set = [], seen = [];
  for (const url of urls) {
    if (!seen.includes(url.href)) {
      url_set.push(url);
      seen.push(url.href);
    }
  }
  return url_set;
}

function opml_import_find_urls(document) {
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

function file_is_opml(file) {
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
  await set_feed_favicon(iconn, feed);
  cdb.validate_feed(feed);
  cdb.sanitize_feed(feed);
  feed.id = await cdb.create_feed(session, feed);

  if (notify) {
    const feed_title = feed.title || feed.urls[feed.urls.length - 1];
    const notif = {};
    notif.title = 'Subscribed!';
    notif.message = 'Subscribed to ' + feed_title;
    notif.url = feed.faviconURLString;
    note.show(notif);
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

export class ConstraintError extends Error {}
