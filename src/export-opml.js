import {get_feeds} from '/src/feed-store/get-feeds.js';
import {console_stub} from '/src/lib/console-stub.js';
import {list_peek} from '/src/lib/list.js';

export async function export_opml(conn, title, console = console_stub) {
  const document = create_opml_document(title, console);
  const feeds = await get_feeds(conn);
  console.debug('Loaded %d feeds from database', feeds.length, conn.name);

  for (const feed of feeds) {
    append_feed(document, feed, console);
  }

  return document;
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

function append_feed(document, feed, console) {
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

  console.debug('Appending feed', outline.getAttribute('xmlUrl'));

  // No idea why, but cannot use document.body here, because it will not find
  // the body element. Possibly because the document is implicitly typed as xml,
  // and document.body does not work for such documents.
  const body_element = document.querySelector('body');
  body_element.appendChild(outline);
}
