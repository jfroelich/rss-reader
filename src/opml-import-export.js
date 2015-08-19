// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = lucu.opml || {};

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

  /*
  var message = {
    type: 'importFeedsCompleted'
  };

  chrome.runtime.sendMessage(message);
  */

  // Send out a notification
  //var notification = (message.feedsAdded || 0) + ' of ';
  //notification += (message.feedsProcessed || 0) + ' feeds imported with ';
  //notification += message.exceptions ? message.exceptions.length : 0;
  //notification += ' error(s).';
  
  var notificationText = 'Successfully imported OPML file';

  lucu.notifications.show(notificationText);  

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
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
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

lucu.opml.exportBlob = function(onComplete) {
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
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
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
  tx.oncomplete = function() {
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
  var blob = new Blob([opmlString], {type:'application/xml'});
  onComplete(blob);
};

lucu.opml.exportSerialize = function(feeds, callback) {
  'use strict';
  var document = lucu.opml.createDocument(feeds, 'subscriptions.xml');
  var xs = new XMLSerializer();
  var opml = xs.serializeToString(document);

  callback(null, opml);
};
