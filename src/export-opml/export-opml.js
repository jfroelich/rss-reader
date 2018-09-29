import * as db from '/src/db/db.js';
import {get_feeds} from '/src/db/op/get-feeds.js';

// TODO: implement tests

// Creates and triggers the download of an OPML document containing feeds from
// the database
export async function export_opml(document_title) {
  // Load feeds from storage
  const session = await db.open();
  const feeds = await get_feeds(session.conn, 'all', false);
  session.close();

  // Map feeds into outlines
  const outlines = [];
  for (const feed of feeds) {
    const outline = {};
    outline.type = feed.type;

    if (feed.urls && feed.urls.length) {
      outline.xml_url = feed.urls[feed.urls.length - 1];
    }

    outline.title = feed.title;
    outline.description = feed.description;
    outline.html_url = feed.link;
    outlines.push(outline);
  }

  // Create an opml document
  const opml_document = create_opml_template(document_title);

  // Append the outlines to the document. This uses querySelector instead of
  // document.body because that shortcut is not available for xml-flagged
  // documents. This creates elements using the xml document instead of the
  // document running this script so as to minimize the risk of XSS and to avoid
  // having the xml document adopt html elements.
  const body_element = opml_document.querySelector('body');
  for (const outline of outlines) {
    const elm = opml_document.createElement('outline');
    set_attr_if_defined(elm, 'type', outline.type);
    set_attr_if_defined(elm, 'xmlUrl', outline.xml_url);
    set_attr_if_defined(elm, 'title', outline.title);
    set_attr_if_defined(elm, 'description', outline.description);
    set_attr_if_defined(elm, 'htmlUrl', outline.html_url);
    body_element.appendChild(elm);
  }

  return opml_document;
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

function set_attr_if_defined(element, name, value) {
  if (value) {
    element.setAttribute(name, value);
  }
}
