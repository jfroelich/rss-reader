import assert from "/src/common/assert.js";
import * as MimeUtils from "/src/common/mime-utils.js";
import * as Status from "/src/common/status.js";
import FaviconCache from "/src/favicon/cache.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as OPMLUtils from "/src/slideshow-page/opml-utils.js";
import Subscribe from "/src/subscribe.js";


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

OPMLImporter.prototype.import = function(files) {
  assert(this.feedStore instanceof FeedStore);
  assert(this.iconCache instanceof FaviconCache);
  assert(files instanceof FileList);

  assert(this.feedStore.isOpen())
  assert(this.iconCache.isOpen());

  console.debug('Importing %d files', files.length);

  // Clone to array due to issues with map on FileList
  const filesArray = [...files];
  const promises = filesArray.map(this.importFile, this);
  return Promise.all(promises);
};

OPMLImporter.prototype.importFile = async function(file) {
  assert(file instanceof File);
  console.log('Importing file', file.name);

  if(file.size < 1) {
    console.warn('File %s is 0 bytes', file.name);
    return 0;
  }

  if(!isXMLContentType(file.type)) {
    console.warn('File %s is not mime type xml', file.type);
    return 0;
  }

  let fileText;
  try {
    fileText = await readFileAsText(file);
  } catch(error) {
    console.warn(error);
    return 0;
  }

  const [status, document, message] = OPMLUtils.parseOPML(fileText);
  if(status !== Status.OK) {
    console.warn(message);
    return 0;
  }

  removeOutlinesWithInvalidTypes(document);
  normalizeOutlineXMLURLs(document);
  removeOutlinesMissingXMLURLs(document);

  const outlines = OPMLUtils.getOutlineObjects(document);
  console.debug('Found %d outlines in file', outlines.length, file.name);
  if(!outlines.length) {
    return 0;
  }

  const uniqueOutlines = groupOutlines(outlines);
  console.debug('Found %d distinct outlines in file', uniqueOutlines.length, file.name);
  uniqueOutlines.forEach(normalizeHTMLURL);

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
  const subscribeResults = await Promise.all(subscribePromises);

  let subCount = 0;
  for(const result of subscribeResults) {
    if(result && result.status === Status.OK) {
      subCount++;
    }
  }

  console.log('Subscribed to %d new feeds in file', subCount, file.name);
  return subCount;
};

function normalizeHTMLURL(outline) {
  assert(OPMLUtils.isOutline(outline));
  if(typeof outline.htmlUrl === 'string') {
    try {
      const urlObject = new URL(outline.htmlUrl);
      outline.htmlUrl = urlObject.href;
    } catch(error) {}
  }
  outline.htmlUrl = undefined;
}

function removeOutlinesWithInvalidTypes(doc) {
  assert(doc instanceof Document);
  const elements = OPMLUtils.getOutlineElements(doc);
  for(const element of elements) {
    if(!elementHasValidType(element)) {
      element.remove();
    }
  }
}

const TYPE_PATTERN = /\s*(rss|rdf|feed)\s*/i;
function elementHasValidType(element) {
  return TYPE_PATTERN.test(element.getAttribute('type'));
}

function normalizeOutlineXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = OPMLUtils.getOutlineElements(doc);
  for(const outlineElement of outlines) {
    const xmlUrlAttributeValue = outlineElement.getAttribute('xmlUrl');
    if(xmlUrlAttributeValue) {
      try {
        const urlObject = new URL(xmlUrlAttributeValue);
        outlineElement.setAttribute('xmlUrl', urlObject.href);
      } catch(error) {
        outlineElement.removeAttribute('xmlUrl');
      }
    } else {
      outlineElement.removeAttribute('xmlUrl');
    }
  }
}

function removeOutlinesMissingXMLURLs(doc) {
  assert(doc instanceof Document);
  const outlines = OPMLUtils.getOutlineElements(doc);
  for(const outline of outlines) {
    if(!elementHasXMLURL(outline)) {
      outline.remove();
    }
  }
}

function elementHasXMLURL(element) {
  const xmlUrl = element.getAttribute('xmlUrl');
  return xmlUrl && xmlUrl.trim();
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
  assert(OPMLUtils.isOutline(outline));

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

  Feed.appendURL(feed, new URL(outline.xmlUrl));
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
