import * as db from '/src/db/db.js';
import assert from '/src/lib/assert.js';

// Returns an in memory OPML document object filled with the feeds from the
// database. |document_title| is optional dom string (set by textContent).
export default async function export_opml(conn, document_title) {
  assert(conn instanceof db.Connection);

  const query = {conn: conn, mode: 'all', title_sort: false};
  const feeds = await db.get_resources(query);
  const outlines = feeds.map(feed_to_outline);

  const doc = create_opml_template(document_title);
  const body_element = doc.querySelector('body');

  for (const outline of outlines) {
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

function feed_to_outline(feed) {
  const outline = {};
  outline.type = feed.type;

  if (db.has_url(feed)) {
    outline.xml_url = db.get_url_string(feed);
  }

  outline.title = feed.title;
  outline.description = feed.description;
  outline.html_url = feed.link;
  return outline;
}

function maybe_set(element, name, value) {
  if (value) {
    element.setAttribute(name, value);
  }
}

function create_opml_template(document_title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (document_title) {
    const title_element = doc.createElement('title');
    title_element.textContent = document_title;
    head_element.appendChild(title_element);
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
