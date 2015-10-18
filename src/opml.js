// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = lucu.opml || {};

/**
 * Returns an OPML XMLDocument object. Feeds should be an array of feed
 * objects. Feed objects should have properties title, url, description, and
 * link. Url is the only required property.
 */
lucu.opml.createDocument = function(feeds, title) {
  'use strict';
  const doc = document.implementation.createDocument(null, null);

  const opml = doc.createElement('opml');
  opml.setAttribute('version', '2.0');
  doc.appendChild(opml);

  const head = doc.createElement('head');
  opml.appendChild(head);

  const titleElement = doc.createElement('title');
  titleElement.textContent = title || 'subscriptions.xml';
  head.appendChild(titleElement);

  const nowString = (new Date()).toUTCString();
  const dateCreated = doc.createElement('dateCreated');
  dateCreated.textContent = nowString;
  head.appendChild(dateCreated);

  const dateModified = doc.createElement('dateModified');
  dateModified.textContent = nowString;
  head.appendChild(dateModified);

  const docs = doc.createElement('docs');
  docs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs);

  if(!feeds) return doc;

  const exportables = feeds.filter(lucu.opml.hasURL);
  if(!exportables.length) return doc;

  const body = doc.createElement('body');
  opml.appendChild(body);

  const createOutline = lucu.opml.createOutlineElement.bind(null, doc);
  const appendOutline = lucu.opml.appendElement.bind(body, body);
  exportables.map(createOutline).forEach(appendOutline);
  return doc;
};

lucu.opml.hasURL = function(feed) {
  'use strict';
  return feed.url;
};

lucu.opml.appendElement = function(body, element) {
  'use strict';
  body.appendChild(element);
};

lucu.opml.createOutlineElement = function(document, feed) {
  'use strict';
  const outline = document.createElement('outline');
  
  // We do not know the original format, so default to rss
  outline.setAttribute('type', 'rss');
  
  const title = feed.title || feed.url;
  outline.setAttribute('text', title);
  outline.setAttribute('title', title);
  outline.setAttribute('xmlUrl', feed.url);
  if(feed.description)
    outline.setAttribute('description', feed.description);
  if(feed.link)
    outline.setAttribute('htmlUrl', feed.link);
  return outline;  
};

/**
 * Generates an array of outline objects from an OPML XMLDocument object.
 *
 * TODO: explicit dependence on lucu.string.stripControls and 
 * lucu.string.stripTags?
 * TODO: guard against duplicates?
 */
lucu.opml.createOutlines = function(document) {
  'use strict';

  if(!lucu.opml.isOPMLDocument(document)) {
    return [];
  }

  const outlines = document.getElementsByTagName('outline');
  const valids = Array.prototype.filter.call(outlines, 
    lucu.opml.outlineElementIsValid);
  return valids.map(lucu.opml.createOutlineFromElement);
};

lucu.opml.isOPMLDocument = function(document) {
  'use strict';
  return document && document.documentElement && 
    document.documentElement.matches('opml');
};

lucu.opml.outlineElementIsValid = function(element) {
  'use strict';
  const type = element.getAttribute('type');
  const url = element.getAttribute('xmlUrl') || '';
  // TODO: use an external constant for the pattern?
  return /rss|rdf|feed/i.test(type) && url.trim();  
};

lucu.opml.createOutlineFromElement = function(element) {
  'use strict';

  // TODO: instead of making a simple object, use
  // a formal Outline function object?

  const outline = {};

  var title = element.getAttribute('title') || '';
  title = title.trim();
  if(!title) {
    title = element.getAttribute('text') || '';
    title = title.trim();
  }

  title = lucu.string.stripControls(title);
  if(title) outline.title = title;

  var description = element.getAttribute('description');
  description = lucu.string.stripControls(description);
  description = lucu.string.stripTags(description);
  description = description.trim();
  if(description) outline.description = description;

  var url = element.getAttribute('xmlUrl') || '';
  url = lucu.string.stripControls(url);
  url = url.trim();
  if(url) outline.url = url;

  var link = element.getAttribute('htmlUrl') || '';
  link = lucu.string.stripControls(link);
  link = link.trim();
  if(link) outline.link = link;

  return outline;
};

////////////////////////////////////////////////////////////
// Import functions

lucu.opml.OPML_MIME_TYPE = 'application/xml';

lucu.opml.import = function(files, onComplete) {
  'use strict';

  const waterfall = [
    lucu.opml.importFilesArray.bind(null, files),
    lucu.opml.mergeOutlines,
    lucu.opml.importConnect,
    lucu.opml.storeOutlines
  ];

  async.waterfall(waterfall, lucu.opml.importCompleted.bind(onComplete));
};

lucu.opml.importCompleted = function(onComplete) {
  'use strict';
  // console.debug('Finished importing feeds from OPML');
  const notificationText = 'Successfully imported OPML file';
  lucu.notifications.show(notificationText);  

  onComplete();
};

lucu.opml.importFilesArray = function(files, callback) {
  'use strict';
  const onFilesLoaded = lucu.opml.onFilesLoaded.bind(null, callback);
  async.map(files, lucu.opml.loadFile, onFilesLoaded);
};

lucu.opml.onFilesLoaded = function(callback, error, results) {
  'use strict';
  callback(null, results);
};

// Reads in the contents of an OPML file as text,
// parses the text into an xml document, extracts
// an array of outline objects from the document,
// and then passes the array to the callback. Async
lucu.opml.loadFile = function(file, callback) {
  'use strict';
  const reader = new FileReader();
  reader.onload = lucu.opml.onFileLoad.bind(reader, callback);
  reader.onerror = lucu.opml.onFileLoadError.bind(reader, callback);
  reader.readAsText(file);
};

lucu.opml.onFileLoad = function(callback, event) {
  'use strict';
  const fileReader = event.target;
  const text = fileReader.result;
  const xmlParser = new DOMParser();
  const xml = xmlParser.parseFromString(text, lucu.opml.OPML_MIME_TYPE);

  if(!xml || !xml.documentElement) {
    callback(null, []);
    return;
  }

  const parserError = xml.querySelector('parsererror');
  if(parserError) {
    callback(null, []);
    return;
  }

  const outlines = lucu.opml.createOutlines(xml);
  callback(null, outlines);
};

lucu.opml.onFileLoadError = function(callback, event) {
  'use strict';
  callback(null, []);
};

// Merges the outlines arrays into a single array.
// Removes duplicates in the process. Sync.
lucu.opml.mergeOutlines = function(outlineArrays, callback) {
  'use strict';
  const outlines = [];
  const seen = new Set();

  function mergeOutlineArray(outlineArray) {
    outlineArray.foreach(mergeOutline);
  }

  function mergeOutline(outline) {
    if(seen.has(outline.url)) return;
    seen.add(outline.url);
    outlines.push(outline);
  }

  outlineArrays.forEach(mergeOutlineArray);
  callback(null, outlines);
};

// TODO: use async.waterfall to deprecate importOnConnect?
lucu.opml.importConnect = function(outlines, callback) {
  'use strict';

  database.connect(function(error, connection) {
    if(error) {
      console.debug(error);
      callback(error);
      return;
    }

    callback(null, connection, outlines); 
  });
};

lucu.opml.storeOutlines = function(connection, outlines, callback) {
  'use strict';
  const storeOutline = lucu.opml.storeOutline.bind(null, connection);
  const onComplete = lucu.opml.onStoreOutlinesComplete.bind(null, callback);
  async.forEach(outlines, storeOutline, onComplete);
};

lucu.opml.onStoreOutlinesComplete = function(callback) {
  'use strict';
  callback();
};

lucu.opml.storeOutline = function(connection, outline, callback) {
  'use strict';
  lucu.feed.put(connection, null, outline, callback);
};

////////////////////////////////////////////////////////////
// Export functions

/**
 * Creates a BLOB object and passes it to onComplete
 */
lucu.opml.export = function(onComplete) {
  'use strict';

  // TODO: deprecate waterfall

  const waterfall = [
    lucu.opml.exportConnect,
    lucu.opml.exportGetFeeds,
    lucu.opml.exportSerialize
  ];

  const completed = lucu.opml.exportCompleted.bind(null, onComplete);
  async.waterfall(waterfall, completed);
};

lucu.opml.exportConnect = function(callback) {
  'use strict';

  database.connect(function(error, connection){
    if(error) {
      console.debug(error);
      callback(error);
    } else {
      callback(null, connection);
    }
  });
};

lucu.opml.exportGetFeeds = function(connection, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.openCursor();
  const feeds = [];
  const onTransactionComplete = lucu.opml.exportGetFeedsTransactionComplete.bind(
    transaction, callback, feeds);
  transaction.oncomplete = onTransactionComplete;
  const onsuccess = lucu.opml.exportGetFeedsOnSuccess.bind(request, feeds);
  request.onsuccess = onsuccess;
};

lucu.opml.exportGetFeedsTransactionComplete = function(callback, feeds, event) {
  'use strict';
  callback(null, feeds);
};

lucu.opml.exportGetFeedsOnSuccess = function(feeds, event) {
  'use strict';
  const cursor = event.target.result;
  if(!cursor) return;
  feeds.push(cursor.value);
  cursor.continue();
};

// TODO: the file name should be a parameter
lucu.opml.exportSerialize = function(feeds, callback) {
  'use strict';
  const document = lucu.opml.createDocument(feeds, 'subscriptions.xml');
  const writer = new XMLSerializer();
  const opml = writer.serializeToString(document);
  callback(null, opml);
};

lucu.opml.exportCompleted = function(callback, error, opmlString) {
  'use strict';
  const blob = new Blob([opmlString], {type:'application/xml'});
  callback(blob);
};
