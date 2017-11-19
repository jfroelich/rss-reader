// For importing feeds from opml file into the reader app

import assert from "/src/utils/assert.js";
import FaviconCache from "/src/favicon/cache.js";
import * as Feed from "/src/feed.js";
import * as FileUtils from "/src/utils/file.js";
import * as idb from "/src/utils/idb.js";
import * as mime from "/src/utils/mime-utils.js";
import * as OPMLDocument from "/src/opml/opml-document.js";
import * as OPMLOutline from "/src/opml/opml-outline.js";
import parseOPML from "/src/opml/parse-opml.js";
import {promiseEvery} from "/src/utils/promise.js";
import * as rdb from "/src/storage/rdb.js";
import * as Subscriber from "/src/reader/subscribe.js";

// Import opml files
// @param files {FileList} a collection of File objects, such as one generated by an HTML input
// element after browsing for files
export default async function main(files) {
  assert(files instanceof FileList);
  console.debug('importing %d files', files.length);

  const fic = new FaviconCache();
  let readerConn;
  try {
    [readerConn] = await Promise.all([rdb.open(), fic.open()]);
    const promises = [];
    for(const file of files) {
      promises.push(importFile(file, readerConn, fic));
    }
    await promiseEvery(promises);
  } finally {
    fic.close();
    rdb.close(readerConn);
  }
}

async function importFile(file, readerConn, iconCache) {
  assert(file instanceof File);
  assert(rdb.isOpen(readerConn));
  assert(iconCache.isOpen());
  console.log('importing opml file', file.name);

  if(file.size < 1) {
    console.log('file %s is 0 bytes', file.name);
    return 0;
  }

  if(!mime.isXML(file.type)) {
    console.log('file %s is not mime type xml', file.type);
    return 0;
  }

  let fileContent;
  try {
    fileContent = await FileUtils.readAsText(file);
  } catch(error) {
    console.warn(error);
    return 0;
  }

  const document = parseOPML(fileContent);
  removeOutlinesWithInvalidTypes(document);
  normalizeOutlineXMLURLs(document);
  removeOutlinesMissingXMLURLs(document);

  const outlines = OPMLDocument.getOutlineObjects(document);
  if(!outlines.length) {
    console.log('file %s contained 0 outlines', file.name);
    return 0;
  }

  const uniqueOutlines = groupOutlines(outlines);
  const dupCount = outlines.length - uniqueOutlines.length;
  console.log('found %d duplicates in file', dupCount, file.name);

  for(const outline of uniqueOutlines) {
    OPMLOutline.normalizeHTMLURL(outline);
  }

  const feeds = [];
  for(const outline of uniqueOutlines) {
    feeds.push(outlineToFeed(outline));
  }

  const subscribeContext = new Subscriber.Context();
  subscribeContext.readerConn = readerConn;
  subscribeContext.iconConn = iconCache.conn;
  subscribeContext.fetchFeedTimeoutMs = timeoutMs;
  subscribeContext.notify = false;

  const subcribePromises = feeds.map(Subscriber.subscribe, subscribeContext);
  const subscribeResults = await promiseEvery(subscribePromises);
  console.log('subbed to %d feeds in file', subscribeResults.length, file.name);
}

function removeOutlinesWithInvalidTypes(doc) {
  assert(doc instanceof Document);
  const elements = OPMLDocument.getOutlineElements(doc);
  const initialLength = elements.length;
  for(const element of elements) {
    if(!OPMLOutline.elementHasValidType(element)) {
      element.remove();
    }
  }

  return initialLength - elements.length;
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

  const feed = {};
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
