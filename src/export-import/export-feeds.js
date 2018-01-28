import assert from "/src/common/assert.js";
import * as OPMLUtils from "/src/export-import/opml-utils.js";
import {feedPeekURL, getFeeds, isFeed} from "/src/rdb.js";

// TODO: decouple from opml-utils. Work with elements directly. Inline whatever helper functions
// in utils are used exclusively here for better logical coherency and reduced coupling

// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
export default function exportFeeds(conn, title) {
  const feeds = await getFeeds(conn);
  const document = createDocumentAndAppendFeeds(feeds, title);
  return xmlToBlob(document);
}

function createDocumentAndAppendFeeds(feeds, title) {
  const doc = OPMLUtils.createDocument(title);
  for(const feed of feeds) {
    OPMLUtils.appendOutlineObject(doc, outlineFromFeed(feed));
  }
  return doc;
}

// Create an outline from a feed
function outlineFromFeed(feed) {
  assert(isFeed(feed));
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feedPeekURL(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

function xmlToBlob(doc) {
  assert(doc instanceof Document);
  const xmlString = xmlToString(doc);
  return new Blob([xmlString], {type: 'application/xml'});
}

function xmlToString(doc) {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}
