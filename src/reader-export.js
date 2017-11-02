'use strict';

// import opml-document.js
// import opml-outline.js
// import xml-utils.js

// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
// @param fileName {String} optional
// @returns {Number} status code
async function readerExportFeeds(feeds, title, fileName) {
  console.assert(Array.isArray(feeds));

  const doc = opmlDocumentCreate();
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
  return RDR_OK;
}
