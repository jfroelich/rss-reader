// Library for exporting feeds to opml file

// Dependencies
// feed.js
// opml.js
// reader-db.js
// xml.js

// Triggers the download of an xml file that is an opml file containing the
// feeds from the reader database
// @param title {String} optional, value of the <title> element in the file
// @param file_name {String} optional, suggested file name
// TODO: do not throw in the usual case, and return status/error codes instead
// TODO: reintroduce database connection as parameter, instead of hard coding.
// This requires more work and boilerplate for the caller, but it is the
// caller's job to manage that complexity, and the convenience here is not
// worth it because the hard coupling leads to overly rigid constraints
async function opml_export(title, file_name) {
  'use strict';

  // Allow exceptions to bubble
  const feeds = await opml_export_db_get_feeds();
  ASSERT(feeds);

  const xml_doc = opml_export_create_document(feeds, title);
  const xml_blob = xml_to_blob(xml_doc);
  const object_url = URL.createObjectURL(xml_blob);
  const anchor_element = document.createElement('a');
  anchor_element.setAttribute('download', file_name);
  anchor_element.href = object_url;
  // There is no need to attach the anchor prior to click
  anchor_element.click();
  URL.revokeObjectURL(object_url);
}

// Helper function that loads feeds from the database
// NOTE: may throw
async function opml_export_db_get_feeds() {
  'use strict';
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

// Creates an opml document
// @param feeds {Array} an array of feed objects
// @param title {String} optional value to store in <title> element
// @returns {Document} an opml document
function opml_export_create_document(feeds, title) {
  'use strict';
  ASSERT(feeds);
  const doc = opml_create_document();
  opml_update_title(doc, title);
  for(const feed of feeds)
    opml_append_outline_object(doc, opml_export_feed_to_outline(feed));
  return doc;
}

// Convert a feed object into an outline object
function opml_export_feed_to_outline(feed) {
  'use strict';
  ASSERT(feed);
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feed_get_top_url(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}
