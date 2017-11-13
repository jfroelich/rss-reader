// Module for exporting feeds to opml file

import assert from "/src/assert.js";
import {
  opmlDocumentAppendOutlineObject,
  opmlDocumentCreate,
  opmlDocumentSetTitle
} from "/src/opml-document.js";

import {opmlOutlineFromFeed} from "/src/opml-outline.js";
import {XMLUtils} from "/src/xml-utils.js";

// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
// @param fileName {String} optional
// @throws Error opmlDocumentSetTitle head element not found error
export function readerExportFeeds(feeds, title, fileName) {
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
