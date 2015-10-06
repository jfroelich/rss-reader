// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = lucu.opml || {};

lucu.opml.OPML_MIME_TYPE = 'application/xml';

lucu.opml.import = function(files, onComplete) {
  'use strict';

  var waterfall = [
    lucu.opml.importFilesArray.bind(null, files),
    lucu.opml.mergeOutlines,
    lucu.opml.importConnect,
    lucu.opml.storeOutlines
  ];

  async.waterfall(waterfall, lucu.opml.importCompleted.bind(onComplete));
};

lucu.opml.importCompleted = function(onComplete) {
  // console.debug('Finished importing feeds from OPML');
  var notificationText = 'Successfully imported OPML file';
  lucu.notifications.show(notificationText);  

  onComplete();
};

lucu.opml.importFilesArray = function(files, callback) {
  var onFilesLoaded = lucu.opml.onFilesLoaded.bind(null, callback);
  async.map(files, lucu.opml.loadFile, onFilesLoaded);
};

lucu.opml.onFilesLoaded = function(callback, error, results) {
  callback(null, results);
};

// Reads in the contents of an OPML file as text,
// parses the text into an xml document, extracts
// an array of outline objects from the document,
// and then passes the array to the callback. Async
lucu.opml.loadFile = function(file, callback) {
  var reader = new FileReader();
  reader.onload = lucu.opml.onFileLoad.bind(reader, callback);
  reader.onerror = lucu.opml.onFileLoadError.bind(reader, callback);
  reader.readAsText(file);
};

lucu.opml.onFileLoad = function(callback, event) {
  'use strict';
  var fileReader = event.target;
  var text = fileReader.result;
  var xmlParser = new DOMParser();
  var xml = xmlParser.parseFromString(text, lucu.opml.OPML_MIME_TYPE);

  if(!xml || !xml.documentElement) {
    callback(null, []);
    return;
  }

  var parserError = xml.querySelector('parsererror');
  if(parserError) {
    callback(null, []);
    return;
  }

  var outlines = lucu.opml.createOutlines(xml);
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
  'use strict';
  var onConnect = lucu.opml.importOnConnect.bind(null, outlines, callback);
  lucu.database.connect(onConnect, callback);
};

lucu.opml.importOnConnect = function(outlines, callback, error, database) {
  'use strict';
  callback(null, database, outlines);
};

lucu.opml.storeOutlines = function(database, outlines, callback) {
  'use strict';
  var storeOutline = lucu.opml.storeOutline.bind(null, database);
  var onComplete = lucu.opml.onStoreOutlinesComplete.bind(null, callback);
  async.forEach(outlines, storeOutline, onComplete);
};

lucu.opml.onStoreOutlinesComplete = function(callback) {
  'use strict';
  callback();
};

// TODO: clean this up a bit more
lucu.opml.storeOutline = function(database, outline, callback) {
  'use strict';

  lucu.addFeed(database, outline, function() {
    callback();
  }, function() {
    callback();
  });
};
