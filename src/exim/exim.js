import {SubscribeOperation} from '/src/feed-ops/subscribe.js';
import * as filelib from '/src/file/file.js';
import * as opml_parser from '/src/opml-parser/opml-parser.js';
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

  const subscriber = new SubscribeOperation();
  subscriber.rconn = feed_conn;
  subscriber.iconn = icon_conn;
  subscriber.channel = channel;
  subscriber.fetch_timeout = fetch_feed_timeout;
  subscriber.notify_flag = false;

  // TODO: this should forward console parameter from import_opml rather than
  // hardcode it

  const partial = import_opml_file_noexcept.bind(null, subscriber, console);
  const promises = Array.prototype.map.call(files, partial);
  return Promise.all(promises);
}

async function import_opml_file_noexcept(subscriber, console, file) {
  try {
    return await import_opml_file(subscriber, console, file);
  } catch (error) {
    console.warn(error);
    return 0;
  }
}

async function import_opml_file(subscriber, console, file) {
  assert(console);
  assert(file instanceof File);
  assert(file.size);
  assert(file_has_feed_type(file));

  console.debug(file);
  const file_text = await filelib.read_text(file);
  const document = opml_parser.parse(file_text);
  const urls = dedup_urls(document_find_feed_urls(document));
  if (!urls.length) {
    return 0;
  }

  const promises = urls.map(subscriber.subscribe, subscriber);
  const stored_feeds = await Promise.all(promises);
  const count = stored_feeds.filter(identity).length;
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

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
