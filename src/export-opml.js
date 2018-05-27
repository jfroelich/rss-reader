import {db_get_feeds} from '/src/db/db-get-feeds.js';
import {list_peek} from '/src/lib/lang/list.js';

// Generates an opml document object consisting of all of the feeds in the
// database. Async.
// Throws an error if title is not a string
// Throws an error if this.conn is undefined or not an IDBDatabase
// Throws an error if a database error occurs
// TODO: write tests
// TODO: consider iterating over feeds without first buffering all feeds into an
// in memory array, this will be more scalable

export async function export_opml(title) {
  this.console.debug(
      '%s: title %s database', export_opml.name, title, this.conn.name);
  const document = create_opml_document(title);
  const feeds = await db_get_feeds(this.conn);
  this.console.debug('%s: loaded %d feeds', export_opml.name, feeds.length);

  for (const feed of feeds) {
    const feed_url = list_peek(feed.urls);
    this.console.debug('%s: appending url', export_opml.name, feed_url);
    append_feed(document, feed);
  }

  return document;
}

function create_opml_document(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (title) {
    const title_element = doc.createElement('title');
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
  return doc;
}

function append_feed(document, feed) {
  const outline = document.createElement('outline');
  if (feed.type) {
    outline.setAttribute('type', feed.type);
  }
  outline.setAttribute('xmlUrl', list_peek(feed.urls));
  if (feed.title) {
    outline.setAttribute('title', feed.title);
  }
  if (feed.description) {
    outline.setAttribute('description', feed.description);
  }
  if (feed.link) {
    outline.setAttribute('htmlUrl', feed.link);
  }

  // No idea why, but cannot use document.body here, because it will not find
  // the body element. Possibly because the document is implicitly typed as xml,
  // and document.body does not work for secretly-xml-flagged documents, at
  // least in Chrome
  const body_element = document.querySelector('body');
  body_element.appendChild(outline);
}
