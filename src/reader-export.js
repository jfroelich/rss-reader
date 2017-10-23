'use strict';

// import opml/opml-document.js
// import opml/opml-outline.js
// import xml.js

// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
// @param file_name {String} optional
// @returns {Number} status code
async function reader_export_feeds(feeds, title, file_name) {
  console.assert(Array.isArray(feeds));

  const doc = opml_document_create();
  opml_document_set_title(doc, title);

  for(const feed of feeds) {
    opml_document_append_outline_object(doc, opml_outline_from_feed(feed));
  }

  const blob = xml_to_blob(doc);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.setAttribute('download', file_name);
  anchor.href = url;
  anchor.click();

  URL.revokeObjectURL(url);
  return STATUS_OK;
}
