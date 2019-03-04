import * as opml_utils from '/src/lib/opml-utils.js';
import {Model} from '/src/model/model.js';

// Returns an in memory OPML document object filled with the feeds from the
// database. document_title is optional.
export async function export_opml(document_title) {
  const doc = opml_utils.create_opml_template(document_title);

  const session = new Model();
  await session.open();
  const feeds = await session.getFeeds('all', false);
  session.close();

  const outlines = feeds.map(feed_to_outline);

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

function feed_to_outline(feed) {
  const outline = {};
  outline.type = feed.type;
  // TODO: use Feed.hasURL
  if (feed.urls && feed.urls.length) {
    // TODO: use Feed.getURLString
    outline.xml_url = feed.urls[feed.urls.length - 1];
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
