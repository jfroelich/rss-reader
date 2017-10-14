// Library for exporting feeds from the database to an opml file

'use strict';

// Dependencies
// assert.js
// feed.js
// opml.js
// reader-db.js
// xml.js

// Triggers the download of an OPML-formatted file containing the feeds from
// the reader database
// @param conn {IDBDatabase} an open connection to the reader database
// @param title {String} optional, value of the <title> element in the file
// @param file_name {String} optional, suggested file name
async function reader_export_feeds(conn, title, file_name) {
  const [status, feeds] = await reader_export_db_get_feeds(conn);
  if(status !== STATUS_OK)
    return status;

  const xml_doc = reader_export_create_document(feeds, title);
  const xml_blob = xml_to_blob(xml_doc);
  const object_url = URL.createObjectURL(xml_blob);

  const anchor = document.createElement('a');
  anchor.setAttribute('download', file_name);
  anchor.href = object_url;
  anchor.click();

  URL.revokeObjectURL(object_url);
  return STATUS_OK;
}

async function reader_export_db_get_feeds(conn) {
  ASSERT(conn);

  try {
    const feeds = await reader_db_get_feeds(conn);
    return [STATUS_OK, feeds];
  } catch(error) {
    DEBUG(error);
    return [ERR_DB_OP];
  }
}

// Creates an opml document from an array of feeds
// @param feeds {Array} an array of basic feed objects
// @param title {String} optional value to store in title element
// @returns {Document} an opml document
function reader_export_create_document(feeds, title) {
  ASSERT(feeds);
  const doc = opml_create_document();
  opml_update_title(doc, title);

  for(const feed of feeds) {
    opml_append_outline_object(doc, reader_export_feed_to_outline(feed));
  }

  return doc;
}

// Convert a feed object into an outline object
function reader_export_feed_to_outline(feed) {
  ASSERT(feed);
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feed_get_top_url(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}
