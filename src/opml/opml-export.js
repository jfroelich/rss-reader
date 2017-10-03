// Dependencies
// reader-db.js
// opml-document.js
// feed.js


(function(exports) {
'use strict';

// Downloads an xml file that is an opml file containing the feeds from
// the database
async function opml_export(title, file_name) {
  // Allow exceptions to bubble
  const feeds = await load_feeds();

  // This does not check the array length, just its definedness
  ASSERT(feeds);

  const opml_doc = create_opml_document(feeds, title);
  const xml_doc = opml_doc.doc;
  const xml_blob = create_opml_blob(xml_doc);
  const object_url = URL.createObjectURL(xml_blob);
  const anchor_element = document.createElement('a');
  anchor_element.setAttribute('download', file_name);
  anchor_element.href = object_url;

  // Note there is no need to attach the anchor prior to click
  anchor_element.click();
  URL.revokeObjectURL(object_url);
}

// May throw an exception
async function load_feeds() {
  let conn;
  let feeds = [];
  try {
    conn = await reader_db.open();
    feeds = await reader_db.get_feeds(conn);
  } finally {
    if(conn)
      conn.close();
  }

  return feeds;
}

// Given an array of feed objects, create a new OPMLDocument instance
function create_opml_document(feeds, title) {
  ASSERT(feeds);

  const doc = new OPMLDocument();

  if(title)
    doc.updateTitle(title);

  for(const feed of feeds) {
    const outline = create_outline(feed);
    doc.appendOutlineObject(outline);
  }

  return doc;
}

// Convert a feed object into an outline object
function create_outline(feed) {
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feed_get_top_url(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

// Expects an xml document object as input (not an OPMLDocument)
function create_opml_blob(doc) {
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(doc);
  return new Blob([xml_string], {'type': 'application/xml'});
}

exports.opml_export = opml_export;

}(this));
