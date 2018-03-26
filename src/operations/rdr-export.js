import {feed_peek_url} from '/src/objects/feed.js';
import {get_feeds} from '/src/operations/get-feeds.js';

export async function rdr_export(conn, title, console = null_console) {
  const document = create_opml_document(title, console);

  const feeds = await get_feeds(conn);
  for (const feed of feeds) {
    append_feed(document, feed, console);
  }

  return create_blob(document);
}

export function create_opml_document(title, console) {
  console.debug('Creating opml document with title:', title);

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

export function create_blob(document) {
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(document);
  return new Blob([xml_string], {type: 'application/xml'});
}

function append_feed(document, feed, console) {
  const outline = document.createElement('outline');
  if (feed.type) {
    outline.setAttribute('type', feed.type);
  }
  outline.setAttribute('xmlUrl', feed_peek_url(feed));
  if (feed.title) {
    outline.setAttribute('title', feed.title);
  }
  if (feed.description) {
    outline.setAttribute('description', feed.description);
  }
  if (feed.link) {
    outline.setAttribute('htmlUrl', feed.link);
  }

  console.debug('Appending feed', outline.getAttribute('xmlUrl'));
  document.body.appendChild(outline);
}

function noop() {}

const null_console = {
  debug: noop,
  log: noop,
  warn: noop,
  error: noop
};
