'use strict';

// import opml-document.js
// import opml-outline.js
// import rbl.js
// import xml-utils.js

// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
// @param fileName {String} optional
// @throws AssertionError
// @throws Error opmlDocumentSetTitle head element not found error
function readerExportFeeds(feeds, title, fileName) {
  assert(Array.isArray(feeds));

  const doc = opmlDocumentCreate();

  // Allow errors to bubble
  opmlDocumentSetTitle(doc, title);

  for(const feed of feeds) {
    opmlDocumentAppendOutlineObject(doc, opmlOutlineFromFeed(feed));
  }

  const blob = XMLUtils.toBlob(doc);
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.setAttribute('download', fileName);
  anchor.href = url;
  anchor.click();

  URL.revokeObjectURL(url);
}
