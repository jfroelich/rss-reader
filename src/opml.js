// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = {};

/**
 * Returns an OPML XMLDocument object. Feeds should be an array of feed
 * objects. Feed objects should have properties title, url, description, and
 * link. Url is the only required property.
 */
lucu.opml.createDocument = function(feeds, title) {
  'use strict';
  var doc = document.implementation.createDocument(null, null);
  var opml = doc.createElement('opml');
  opml.setAttribute('version', '2.0');
  doc.appendChild(opml);
  var head = doc.createElement('head');
  opml.appendChild(head);
  var titleElement = doc.createElement('title');
  titleElement.textContent = title || 'subscriptions.xml';
  head.appendChild(titleElement);
  var nowString = (new Date()).toUTCString();
  var dateCreated = doc.createElement('dateCreated');
  dateCreated.textContent = nowString;
  head.appendChild(dateCreated);
  var dateModified = doc.createElement('dateModified');
  dateModified.textContent = nowString;
  head.appendChild(dateModified);
  var docs = doc.createElement('docs');
  docs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(docs);
  if(!feeds) return doc;
  var exportables = feeds.filter(function (feed) {
    return feed.url;
  });
  if(!exportables.length) return doc;
  var body = doc.createElement('body');
  opml.appendChild(body);

  // TODO: test, pretty sure the null is the context, the doc
  // is the partial first arg
  var createOutline = lucu.createOutlineElement.bind(null, doc);

  var appendOutlineElement = function(element) {
    body.appendChild(element);
  };

  exportables.map(createOutline).forEach(appendOutlineElement);

  return doc;
};

lucu.opml.createOutlineElement = function(document, feed) {
  var outline = document.createElement('outline');
  
  // We do not know the original format, so default to rss
  outline.setAttribute('type', 'rss');
  
  var title = feed.title || feed.url;
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
 * TODO: explicit dependence on lucu.stripControls and lucu.stripTags?
 * TODO: guard against duplicates?
 */
lucu.opml.createOutlines = function(document) {
  'use strict';

  var filter = Array.prototype.filter;
  var isValid = lucu.opml.outlineElementIsValid;
  var createOutline = lucu.opml.createOutlineFromElement;
  
  if(!lucu.opml.isOPMLDocument(document)) {
    return [];
  }

  // TODO: document.documentElement.get...?
  var outlineElements = document.getElementsByTagName('outline');
  var validElements = filter.call(outlineElements, isValid);
  return validElements.map(createOutline);
};

lucu.opml.isOPMLDocument = function(document) {
  return document && document.documentElement && 
    document.documentElement.matches('opml');
};

lucu.opml.outlineElementIsValid = function(element) {
  var type = element.getAttribute('type');
  var url = element.getAttribute('xmlUrl') || '';
  return /rss|rdf|feed/i.test(type) && url.trim();  
};

lucu.opml.createOutlineFromElement = function(element) {
  var outline = {};
  var title = element.getAttribute('title') || '';
  title = title.trim();
  if(!title) {
    title = element.getAttribute('text') || '';
    title = title.trim();
  }

  title = lucu.stripControls(title);
  if(title) outline.title = title;

  var description = element.getAttribute('description');
  description = lucu.stripControls(description);
  description = lucu.stripTags(description);
  description = description.trim();
  if(description) outline.description = description;

  var url = element.getAttribute('xmlUrl') || '';
  url = lucu.stripControls(url);
  url = url.trim();
  if(url) outline.url = url;

  var link = element.getAttribute('htmlUrl') || '';
  link = lucu.stripControls(link);
  link = link.trim();
  if(link) outline.link = link;

  return outline;
};

// TODO: test
lucu.opml.importFiles = function(files, onComplete) {
  'use strict';

  var waterfall = [
    lucu.opml.importFilesArray.bind(null, files),
    lucu.opml.mergeOutlines,
    lucu.opml.importConnect,
    lucu.opml.storeOutlines
  ];

  async.waterfall(waterfall, 
    lucu.opml.importCompleted.bind(onComplete));
};

lucu.opml.importCompleted = function(onComplete) {
  console.debug('Finished importing feeds');

  var message = {
    type: 'importFeedsCompleted'
  };

  chrome.runtime.sendMessage(message);
  onComplete();
};

lucu.opml.importFilesArray = function(files, callback) {
  
  function onMapComplete(error, results) {
    callback(null, results);
  }

  async.map(files, lucu.opml.loadFile, onMapComplete);
};

// Reads in the contents of an OPML file as text,
// parses the text into an xml document, extracts
// an array of outline objects from the document,
// and then passes the array to the callback. Async
lucu.opml.loadFile = function(file, callback) {
  var reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function (event) {
    var text = event.target.result;
    var parser = new DOMParser();
    var xml = parser.parseFromString(text, 'application/xml');
    if(!xml || !xml.documentElement) {
      return callback(null, []);
    }
    var parserError = xml.querySelector('parsererror');
    if(parserError) {
      return callback(null, []);
    }

    var outlines = lucu.opml.createOutlines(xml);
    callback(null, outlines);
  };
  reader.onerror = function (event) {
    callback(null, []);
  };
};

// Merges the outlines arrays into a single array.
// Removes duplicates in the process. Sync.
lucu.opml.mergeOutlines = function(outlineArrays, callback) {
  var outlines = [];
  var seen = new Set();

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

lucu.opml.importConnect = function(outlines, callback) {
  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  // NOTE: causes event object to be passed as error argument
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = function(event) {
    callback(null, event.target.result, outlines);
  };
};

lucu.opml.storeOutlines = function(db, outlines, callback) {
  async.forEach(outlines, function(outline, callback) {
    lucu.addFeed(db, outline, function() {
      callback();
    }, function() {
      callback();
    });
  }, function() {
    callback();
  });
};

// TODO: test
// TODO: pass blob because nothing needs the intermediate string, then rename
lucu.opml.exportString = function(onComplete) {
  'use strict';

  var waterfall = [
    lucu.opml.exportConnect,
    lucu.opml.exportGetFeeds,
    lucu.opml.exportSerialize
  ];

  // TODO: test, null is 'this' and onComplete is the implied first arg
  var completed = lucu.opml.exportCompleted.bind(null, onComplete);

  async.waterfall(waterfall, completed);
};

// TODO: this can probably be a shared function in database.js
lucu.opml.exportConnect = function(callback) {
  'use strict';
  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = function(event) {
    callback(null, event.target.result);
  };
};

lucu.opml.exportGetFeeds = function(db, callback) {
  'use strict';
  var tx = db.transaction('feed');
  var store = tx.objectStore('feed');
  var request = store.openCursor();
  var feeds = [];
  tx.onComplete = function() {
    callback(null, feeds);
  };
  request.onsuccess = function(event) {
    var cursor = event.target.result;
    if(!cursor) return;
    feeds.push(cursor.value);
    cursor.continue();
  };
};

lucu.opml.exportCompleted = function(onComplete, error, opmlString) {
  'use strict';
  onComplete(opmlString);
};

lucu.opml.exportSerialize = function(feeds, callback) {
  'use strict';
  var document = lucu.opml.createDocument(feeds, 'subscriptions.xml');
  var xs = new XMLSerializer();
  var opml = xs.serializeToString(document);
  callback(null, opml);
};
