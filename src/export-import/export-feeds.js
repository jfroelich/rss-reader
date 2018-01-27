import assert from "/src/common/assert.js";
import * as OPMLUtils from "/src/export-import/opml-utils.js";
import {feedPeekURL, isFeed} from "/src/rdb.js";

// TODO: Change to return a blob object. Move downloadBlob to calling context. Export shouldn't
// care how the blob is used.
// TODO: the idea to require feeds as a parameter and move all the database functionality out of
// here was a mistake. Instead, this should connect and load feeds on its own, and feeds shouldn't
// be a parameter. Part of the reason is that this isn't generic. It only applies to exporting
// feeds. It is not like the array of feeds is ever going to come from somewhere else, or mean
// something different. Another part of the reason is that it is perfectly ok to marry this to
// the database. That marriage is basically obvious and intended and what this functionality
// essentially represents. Another reason is that import-opml-files is privy to model access, so
// it does not make sense to deny access here or stay model-agnostic, and it would be more
// consistent if both import and export has the same style of storage interaction.
// TODO: possibly move this to entire module to within the storage folder. What this functionality
// really represents is a way to serialize or deserialize the storage model as a whole externally.
// Or, move certain parts to the feed-store folder, delegate storage-related functionality to
// feed-store.

// TODO: for both backup and opml modules, drop support for opml outline objects. Instead,
// work exclusively with elements. However, maintain a separation between generic opml
// functionality, and functionality specific to this app. It is ok for backup to have
// knowledge of the feed model, but not for opml. So, in order for this to, for example,
// append a feed to an opml document, it has to be able to create the outline element here,
// and call OPMLUtils.appendOutlineElement instead of appendOutlineObject.
// The current behavior is to create an outline object representing the feed, then call
// append, which converts the outline object to an outline element, and then appends the
// outline element.  Instead, directly create the element.


// Triggers the download of an OPML-formatted file containing the given feeds
// @param feeds {Array}
// @param title {String} optional
// @param fileName {String} optional
export default function exportFeeds(feeds, title, fileName) {
  assert(Array.isArray(feeds));
  const doc = createOPMLDocumentFromFeeds(feeds, title);
  const blob = xmlToBlob(doc);
  downloadBlob(blob, fileName);
}

function createOPMLDocumentFromFeeds(feeds, title) {
  const doc = OPMLUtils.createDocument(title);
  for(const feed of feeds) {
    OPMLUtils.appendOutlineObject(doc, outlineFromFeed(feed));
  }
  return doc;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('download', filename);
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
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
