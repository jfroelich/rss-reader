// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Returns an OPML XMLDocument object. Feeds should be an array of feed
 * objects. Feed objects should have properties title, url, description, and
 * link. Url is the only required property.
 */
lucu.createOPMLDocument = function(feeds, title) {
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

  var createOutline = lucu.createOutlineElement.bind(doc);

  var appendOutlineElement = function(element) {
    body.appendChild(element);
  };

  exportables.map(createOutline).forEach(appendOutlineElement);

  return doc;
};

lucu.createOutlineElement = function(document, feed) {
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
lucu.createOPMLOutlines = function(doc) {
  'use strict';
  
  if(!doc || !doc.documentElement || !doc.documentElement.matches('opml')) {
    return [];
  }
  
  var filter = Array.prototype.filter;
  
  // TODO: doc.documentElement.get...?
  var outlineElements = doc.getElementsByTagName('outline');
  var validElements = filter.call(outlineElements, lucu.outlineElementIsValid);
  return validElements.map(lucu.createOutlineFromElement);
};

lucu.outlineElementIsValid = function(element) {
  var type = element.getAttribute('type');
  var url = element.getAttribute('xmlUrl') || '';
  return /rss|rdf|feed/i.test(type) && url.trim();  
};

lucu.createOutlineFromElement = function(element) {
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
lucu.importOPMLFiles = function(files, onComplete) {
  'use strict';

  var waterfallFunctions = [
    lucu.importOPMLFiles.bind(files),
    lucu.mergeOutlines,
    lucu.importOPMLConnect,
    lucu.storeOutlines
  ];

  async.waterfall(waterfallFunctions, 
    lucu.importOPMLWaterfallOnComplete.bind(onComplete));
};

lucu.importOPMLWaterfallOnComplete = function(onComplete) {
  console.debug('Finished importing feeds');

  var message = {
    type: 'importFeedsCompleted'
  };

  chrome.runtime.sendMessage(message);
  onComplete();
};

lucu.importOPMLFiles = function(files, callback) {
  
  function onMapComplete(error, results) {
    callback(null, results);
  }

  async.map(files, lucu.loadFile, onMapComplete);
};

// Reads in the contents of an OPML file as text,
// parses the text into an xml document, extracts
// an array of outline objects from the document,
// and then passes the array to the callback. Async
lucu.loadFile = function(file, callback) {
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

    var outlines = lucu.createOPMLOutlines(xml);
    callback(null, outlines);
  };
  reader.onerror = function (event) {
    callback(null, []);
  };
};

// Merges the outlines arrays into a single array.
// Removes duplicates in the process. Sync.
lucu.mergeOutlines = function(outlineArrays, callback) {
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

lucu.importOPMLConnect = function(outlines, callback) {
  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  // NOTE: causes event object to be passed as error argument
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = function(event) {
    callback(null, event.target.result, outlines);
  };
};

// Stores the outlines in indexedDB, async
lucu.storeOutlines = function(db, outlines, callback) {
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
lucu.exportOPMLString = function(onComplete) {
  'use strict';

  async.waterfall([connect, getFeeds, serialize], waterfallCompleted);

  function connect(callback) {
    var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
    request.onerror = callback;
    request.onblocked = callback;
    request.onsuccess = function(event) {
      callback(null, event.target.result);
    };
  }

  function getFeeds(db, callback) {
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
  }

  function serialize(feeds, callback) {
    var document = lucu.createOPMLDocument(feeds, 'subscriptions.xml');
    var xs = new XMLSerializer();
    var opml = xs.serializeToString(document);
    callback(null, opml);
  }

  function waterfallCompleted(error, opmlString) {
    onComplete(opmlString);
  }
};
