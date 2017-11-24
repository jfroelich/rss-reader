import assert from "/src/assert.js";
import * as Feed from "/src/storage/feed.js";
import * as OPMLDocument from "/src/opml/document.js";
import {xmlToBlob} from "/src/xml/utils.js";

// TODO: for both backup and opml modules, drop support for opml outline objects. Instead,
// work exclusively with elements. However, maintain a separation between generic opml
// functionality, and functionality specific to this app. It is ok for backup to have
// knowledge of the feed model, but not for opml. So, in order for this to, for example,
// append a feed to an opml document, it has to be able to create the outline element here,
// and call OPMLDocument.appendOutlineElement instead of appendOutlineObject.
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
