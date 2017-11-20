// Module for exporting feeds to opml file

import assert from "/src/utils/assert.js";
import * as Feed from "/src/storage/feed.js";
import * as OPMLDocument from "/src/opml/document.js";
import {xmlToBlob} from "/src/xml/utils.js";

// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
// @param fileName {String} optional
export function exportFeeds(feeds, title, fileName) {
  assert(Array.isArray(feeds));
  const doc = createOPMLDocumentFromFeeds(feeds, title);
  const blob = xmlToBlob(doc);
  downloadBlob(blob, fileName);
}

function createOPMLDocumentFromFeeds(feeds, title) {
  const doc = OPMLDocument.create(title);
  for(const feed of feeds) {
    OPMLDocument.appendOutlineObject(doc, outlineFromFeed(feed));
  }
  return doc;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('download', fileName);
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
}

// Create an outline from a feed
function outlineFromFeed(feed) {
  assert(Feed.isFeed(feed));
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = Feed.peekURL(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}
