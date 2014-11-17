// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: test

lucu.importOPMLFiles = function(files, onComplete) {
  'use strict';

  async.waterfall([load,merge,connect,store], waterfallCompleted);

  // Reads in the contents of an OPML file as text,
  // parses the text into an xml document, extracts
  // an array of outline objects from the document,
  // and then passes the array to the callback. Async
  function loadFile(file, callback) {
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function (event) {
      var text = event.target.result;
      var xml = null;
      try {
        xml = lucu.parseXML(text);
      } catch(e) {
        return callback(null, []);
      }

      var outlines = lucu.createOPMLOutlines(xml);
      callback(null, outlines);
    };
    reader.onerror = function (event) {
      callback(null, []);
    };
  }

  function load(callback) {
    // accesses 'files' from outer scope
    async.map(files, loadFile, function (error, results) {
      callback(null, results);
    });
  }

  // Merges the outlines arrays into a single array.
  // Removes duplicates in the process. Sync.
  function merge(outlineArrays, callback) {
    var outlines = [];
    var seen = new Set();
    outlineArrays.forEach(function(outlineArray) {
      outlineArray.foreach(function(outline) {
        if(seen.has(outline.url)) return;
        seen.add(outline.url);
        outlines.push(outline);
      });
    });

    callback(null, outlines);
  }

  // Connects to indexedDB, async
  function connect(outlines, callback) {
    var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
    // NOTE: causes event object to be passed as error argument
    request.onerror = callback;
    request.onblocked = callback;
    request.onsuccess = function(event) {
      callback(null, event.target.result, outlines);
    };
  }

  // Stores the outlines in indexedDB, async
  function store(db, outlines, callback) {
    async.forEach(outlines, function(outline, callback) {
      lucu.feed.add(db, outline, function() {
        callback();
      }, function() {
        callback();
      });
    }, function() {
      callback();
    });
  }

  function waterfallCompleted() {
    console.debug('Finished importing feeds');
    chrome.runtime.sendMessage({
      type: 'importFeedsCompleted'
    });
    onComplete();
  }
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
