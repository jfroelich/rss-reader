import {SubscribeOperation} from '/src/feed-ops/subscribe.js';
import * as filelib from '/src/file/file.js';
import * as opml_document from '/src/opml-document/opml-document.js';
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
  const doc = opml_document.create_document(title);

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

    doc.body.appendChild(outline_element);
  }

  return opml_document.to_blob(doc);
}

export function import_opml(
    feed_conn, icon_conn, channel, fetch_feed_timeout, console, files) {
  assert(files instanceof FileList);
  console.log('Importing %d file(s)', files.length);

  const subscriber = new SubscribeOperation();
  subscriber.rconn = feed_conn;
  subscriber.iconn = icon_conn;
  subscriber.channel = channel;
  subscriber.fetch_timeout = fetch_feed_timeout;
  subscriber.notify_flag = false;

  const partial = import_opml_file.bind(null, subscriber, console);
  const promises = Array.prototype.map.call(files, partial);
  return Promise.all(promises);
}

async function import_opml_file(subscriber, console, file) {
  if (!(file instanceof File)) {
    throw new TypeError('file is not a File');
  }

  if (!file.size) {
    return 0;
  }

  const feed_mime_types = [
    'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
    'application/xml', 'application/xhtml+xml', 'text/xml'
  ];
  if (!feed_mime_types.includes(file.type)) {
    return 0;
  }

  console.debug(file);
  const file_text = await filelib.read_text(file);

  let document;
  try {
    document = opml_parser.parse(file_text);
  } catch (error) {
    console.debug(error);
    return 0;
  }

  const urls = dedup_urls(opml_document.find_feed_urls(document));

  const promises = urls.map(subscriber.subscribe, subscriber);
  const stored_feeds = await Promise.all(promises);
  const count = stored_feeds.reduce((sum, v) => v ? sum : sum + 1, 0);
  console.debug(file.name, count);
  return count;
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
