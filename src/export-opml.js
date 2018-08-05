import * as array from '/src/lib/array.js';
import {openModelAccess} from '/src/model/model-access.js';

// Creates and triggers the download of an OPML document containing feeds from
// the database
export async function export_opml() {
  // Load feeds
  const use_channel = false, sort_feeds = false, mode = 'all';
  const ma = await openModelAccess(use_channel);
  const feeds = await ma.getFeeds(mode, sort_feeds);
  ma.close();

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
  const title = 'Subscriptions';
  const opml_document = create_opml_template(title);

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

  // Generate a file (files implement the Blob interface)
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  const blob = new Blob([xml_string], {type: 'application/xml'});

  // Download the file by simulating an anchor click
  // NOTE: this was broken in Chrome 65 and then fixed. For Chrome 65, using
  // the chrome.downloads technique worked as an alternative, but now that also
  // no longer works, and this anchor strategy works again
  const anchor = document.createElement('a');
  const filename = 'subscriptions.xml';
  anchor.setAttribute('download', filename);
  const url = URL.createObjectURL(blob);
  anchor.setAttribute('href', url);
  anchor.click();
  URL.revokeObjectURL(url);
}

function create_opml_template(title) {
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

function set_attr_if_defined(element, name, value) {
  if (value) {
    element.setAttribute(name, value);
  }
}
