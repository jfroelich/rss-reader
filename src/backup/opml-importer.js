import assert from "/src/common/assert.js";
import FaviconCache from "/src/favicon/cache.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as OPMLDocument from "/src/opml/document.js";
import * as OPMLOutline from "/src/opml/outline.js";
import parseOPML from "/src/opml/parse.js";
import Subscribe from "/src/reader/subscribe.js";
import * as MimeUtils from "/src/utils/mime-utils.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";

export default function OPMLImporter() {
  this.feedStore = null;
  this.iconCache = null;
  this.fetchFeedTimeoutMs = void 0;
}

OPMLImporter.prototype.init = function() {
  this.feedStore = new FeedStore();
  this.iconCache = new FaviconCache();
};

OPMLImporter.prototype.open = async function() {
  assert(this.feedStore instanceof FeedStore);
  assert(this.iconCache instanceof FaviconCache);
  const promises = [this.feedStore.open(), this.iconCache.open()];
  await Promise.all(promises);
};

OPMLImporter.prototype.close = function() {
  if(this.feedStore) {
    this.feedStore.close();
  }

  if(this.iconCache) {
    this.iconCache.close();
  }
};

// Import opml files
// @param files {FileList} a collection of File objects, such as one generated by an HTML input
// element after browsing for files
// @return {Promise} a promise that resolves to an array with length corresponding to the number
// of files imported, and for each file the number of feeds subscribed, or undefined if there was
// an error for that file.
OPMLImporter.prototype.import = function(files) {
  assert(this.feedStore instanceof FeedStore);
  assert(this.iconCache instanceof FaviconCache);
  assert(this.feedStore.isOpen())
  assert(this.iconCache.isOpen());

  assert(files instanceof FileList);
  console.debug('Importing %d files', files.length);

  // Clone to array due to issues with map on FileList
  const filesArray = [...files];
  const promises = filesArray.map(this.importFile, this);
  return PromiseUtils.promiseEvery(promises);
};

OPMLImporter.prototype.importFile = async function(file) {
  assert(file instanceof File);
  console.log('Importing file', file.name);

  if(file.size < 1) {
    console.log('File %s is 0 bytes', file.name);
    return 0;
  }

  if(!isXMLContentType(file.type)) {
    console.log('File %s is not mime type xml', file.type);
    return 0;
  }

  const fileText = await readFileAsText(file);
  const document = parseOPML(fileText);
  removeOutlinesWithInvalidTypes(document);
  normalizeOutlineXMLURLs(document);
  removeOutlinesMissingXMLURLs(document);

  const outlines = OPMLDocument.getOutlineObjects(document);
  console.debug('Found %d outlines in file', outlines.length, file.name);
  if(!outlines.length) {
    return 0;
  }

  const uniqueOutlines = groupOutlines(outlines);
  console.debug('Found %d distinct outlines in file', uniqueOutlines.length, file.name);
  uniqueOutlines.forEach(OPMLOutline.normalizeHTMLURL);

  const subscribe = new Subscribe();
  subscribe.fetchFeedTimeoutMs = this.fetchFeedTimeoutMs;
  subscribe.notify = false;
  // Signal to subscribe that it should not attempt to poll the feed's entries
  subscribe.concurrent = true;

  // Bypass Subscribe.prototype.init, hard wire the connections
  subscribe.feedStore = this.feedStore;
  subscribe.iconCache = this.iconCache;

  const feeds = uniqueOutlines.map(outlineToFeed);
  const feedURLs = feeds.map(feed => new URL(Feed.peekURL(feed)));
  const subscribePromises = feedURLs.map(subscribe.subscribe, subscribe);
  const subscribeResults = await PromiseUtils.promiseEvery(subscribePromises);

  let subCount = 0;
  for(const result of subscribeResults) {
    if(result) {
      subCount++;
    }
  }

  console.log('Subscribed to %d new feeds in file', subCount, file.name);
  return subCount;
};

function removeOutlinesWithInvalidTypes(doc) {
  assert(doc instanceof Document);
  const elements = OPMLDocument.getOutlineElements(doc);
  for(const element of elements) {
    if(!OPMLOutline.elementHasValidType(element)) {
      element.remove();
    }
  }
}

function normalizeOutlineXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = OPMLDocument.getOutlineElements(doc);
  for(const outline of outlines) {
    OPMLOutline.elementNormalizeXMLURL(outline);
  }
}

function removeOutlinesMissingXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = OPMLDocument.getOutlineElements(doc);
  for(const outline of outlines) {
    if(!OPMLOutline.elementHasXMLURL(outline)) {
      outline.remove();
    }
  }
}

// Filter duplicates, favoring earlier in array order
function groupOutlines(outlines) {
  const uniqueURLs = [];
  const uniqueOutlines = [];
  for(const outline of outlines) {
    if(!uniqueURLs.includes(outline.xmlUrl)) {
      uniqueOutlines.push(outline);
      uniqueURLs.push(outline.xmlUrl);
    }
  }
  return uniqueOutlines;
}

// Convert an outline object into a feed
function outlineToFeed(outline) {
  assert(OPMLOutline.isOutline(outline));

  // Note that this uses create, not a simple object, to allow magic to happen
  const feed = Feed.create();

  if(outline.type) {
    feed.type = outline.type;
  }

  if(outline.title) {
    feed.title = outline.title;
  }

  if(outline.text) {
    feed.text = outline.text;
  }

  if(outline.description) {
    feed.description = outline.description;
  }

  if(outline.htmlUrl) {
    feed.link = outline.htmlUrl;
  }

  Feed.appendURL(feed, outline.xmlUrl);
  return feed;
}

// Returns a promise that resolves to the full text of a file
function readFileAsText(file) {
  return new Promise(function executor(resolve, reject) {
    assert(file instanceof File);
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

function isXMLContentType(contentType) {
  const types = [
    'application/atom+xml',
    'application/rdf+xml',
    'application/rss+xml',
    'application/vnd.mozilla.xul+xml',
    'application/xml',
    'application/xhtml+xml',
    'text/xml'
  ];

  return types.includes(MimeUtils.fromContentType(contentType));
}
