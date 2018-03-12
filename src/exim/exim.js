import subscribe from '/src/feed-ops/subscribe.js';
import * as rdb from '/src/rdb/rdb.js';

// Returns an opml document as a blob that contains outlines representing the
// feeds in the app's db
// @param conn {IDBDatabase} optional, an open connection to the reader database
// @param title {String} optional, the value to use for the title element in the
// document
export async function export_opml(conn, title) {
  assert(conn instanceof IDBDatabase);
  const feeds = await rdb.get_feeds(conn);

  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  const title_element = doc.createElement('title');
  if (title) {
    title_element.textContent = title;
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

  // Append the feeds to the document as outline elements
  for (const feed of feeds) {
    const outline_element = doc.createElement('outline');
    if (feed.type) {
      outline_element.setAttribute('type', feed.type);
    }
    outline_element.setAttribute('xmlUrl', rdb.feed_peek_url(feed));
    if (feed.title) {
      outline_element.setAttribute('title', feed.title);
    }
    if (feed.description) {
      outline_element.setAttribute('description', feed.description);
    }
    if (feed.link) {
      outline_element.setAttribute('htmlUrl', feed.link);
    }

    body_element.appendChild(outline_element);
  }

  // Serialize the document as a string and create and return a blob
  const serializer = new XMLSerializer();
  const string = serializer.serializeToString(doc);
  return new Blob([string], {type: 'application/xml'});
}

// Imports one or more opml files into the app
// @param feedConn {IDBDatabase} open conn to reader database
// @param iconConn {IDBDatabase} open conn to favicon database
// @param channel {BroadcastChannel} optional channel to notify of storage
// events
// @param fetch_feed_timeout {Number} parameter forwarded to subscribe
// @param files {FileList} a list of opml files to import
// @return {Promise} a promise that resolves to an array of numbers, or rejects
// with an error. Each number corresponds to a count of the number of feeds
// subscribed from the file. That some files fail to import does not mean
// other files were not imported
export function import_opml(
    feed_conn, icon_conn, channel, fetch_feed_timeout, files) {
  assert(files instanceof FileList);
  console.log('Importing %d file(s)', files.length);

  const context = {
    feedConn: feed_conn,
    iconConn: icon_conn,
    channel: channel,
    fetchFeedTimeout: fetch_feed_timeout,
    notify: false
  };

  // TODO: this should forward console parameter from import_opml rather than
  // hardcode it

  const partial = import_opml_file_noexcept.bind(null, context, console);
  const promises = Array.prototype.map.call(files, partial);
  return Promise.all(promises);
}

async function import_opml_file_noexcept(context, console, file) {
  try {
    return await import_opml_file(context, console, file);
  } catch (error) {
    console.warn(error);
    return 0;
  }
}

// Reads the file, parses the opml, and then subscribes to each of the feeds
// Returns the count of feeds subscribed.
// @param context {Object} parameters for subscribing to a feed
// @param file {File} the file to import
// @param console {Object} a console-like object for logging
async function import_opml_file(context, console, file) {
  assert(context);
  assert(console);
  assert(file instanceof File);
  assert(file.size);
  assert(file_has_feed_type(file));

  console.debug(file);
  const file_text = await file_read_as_text(file);
  const document = opml_parse(file_text);
  const urls = dedup_urls(document_find_feed_urls(document));
  if (!urls.length) {
    return 0;
  }

  const partial = subscribe_noexcept.bind(null, context);
  const promises = urls.map(partial);
  const subscribe_return_vals = await Promise.all(promises);
  const count = subscribe_return_vals.filter(identity).length;
  console.debug(file.name, count);
  return count;
}

function file_has_feed_type(file) {
  const types = [
    'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
    'application/xml', 'application/xhtml+xml', 'text/xml'
  ];
  return types.includes(file.type);
}

function identity(value) {
  return value;
}

// Call subscribe while suppressing any exceptions. Exceptions are simply logged
async function subscribe_noexcept(subscribe_ctx, url) {
  try {
    return await subscribe(subscribe_ctx, url);
  } catch (error) {
    console.debug(error);
  }
}

// Searches an OPML document for urls of feeds. Returns an array of 0 or more
// urls found. Each element is a URL object. Only outlines that are correctly
// typed as a representing a feed are included in the result. Only valid urls
// are included in the result. By using URL objects, the urls are also
// normalized. The resulting urls are not guaranteed to be distinct.
function document_find_feed_urls(document) {
  const elements = document.querySelectorAll('opml > body > outline');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const value = element.getAttribute('xmlUrl');
      if (value) {
        try {
          urls.push(new URL(value));
        } catch (error) {
        }
      }
    }
  }

  return urls;
}

// Given an array of URL objects, returns a new array where duplicate urls
// have been removed.
function dedup_urls(urls) {
  const unique_urls = [], seen_url_strings = [];
  for (const url of urls) {
    if (!seen_url_strings.includes(url.href)) {
      unique_urls.push(url);
      seen_url_strings.push(url.href);
    }
  }
  return unique_urls;
}

// TODO: the error thrown should indicate file name
function file_read_as_text(file) {
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

function xml_parse(xml_string) {
  assert(typeof xml_string === 'string');
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    const pretty_message = error.textContent.replace(/\s{2,}/g, ' ');
    throw new Error(pretty_message);
  }
  return document;
}

function opml_parse(xml_string) {
  // Rethrow xml_parse errors
  const document = xml_parse(xml_string);
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
