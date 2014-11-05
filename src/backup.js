// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Module for importing and exporting feed meta data
 */
(function(exports) {
'use strict';

// TODO: think of a better name that captures both import and export
// TODO: this module, as a whole, needs alot of cleanup. There are a lot
// of nested functions and the continuation passing style is obscure.
// TODO: I don't need the backup namespace, deprecate it

/**
 * Calls onComplete with num feeds added, num feeds processed, and
 * array of exceptions
 *
 * TODO: this needs testing, is it still reading in files?
 * TODO: just allow for add feed to fail on dup instead of agg?
 * TODO: rather than agg per file, agg at the end
 * TODO: use better name for outlinesHash, maybe use Set
 */
function importOPMLFiles(files, onComplete) {

  if(!files || !files.length) {
    return onComplete(0, 0, []);
  }

  var exceptions = [];
  var fileCounter = files.length;
  var outlinesHash = {};

  Array.prototype.forEach.call(files, function (event) {
    try {
      var xmlDocument = lucu.parseXML(this.result);
    } catch(parseError) {
      // BUG?: exiting early means filecounter is never checked
      // leading to the continuation never being called
      return exceptions.push(parseError);
    }

    var outlines = lucu.opml.createOutlines(xmlDocument);
    outlines.forEach(function(outline) {
      if(outline.url) {
        outlinesHash[outline.url] = outline;
      }
    });

    fileCounter--;

    if(!fileCounter) {
      var distinctFeeds = arrayValues(outlinesHash);
      importFeeds(distinctFeeds, exceptions, onComplete);
    }
  });
}

function arrayValues(object) {
  var keys = Object.keys(object);
  var hasOwn = Object.prototype.hasOwnProperty;
  var values = [];
  for(var i = 0, key, len = keys.length; i < len; i++) {
    key = keys[i];
    if(hasOwn.call(object, key)) {
      values.push(object[key]);
    }
  }

  return values;
}

// TODO: is this even in use anymore? the above function iterates over
// files, is that right?
function loadAsText(onFileLoad, file) {
  var reader = new FileReader();
  reader.onload = onFileLoad;
  reader.readAsText(file);
}

function importFeeds(feeds, exceptions, onComplete) {
  var feedsProcessed = 0;
  var feedsAdded = 0;

  if(!feeds || !feeds.length) {
    return onComplete(feedsAdded, feedsProcessed, exceptions);
  }

  lucu.database.open(function(db) {
    feeds.forEach(function(feed) {
      lucu.feed.add(db, feed, function() {
        feedsAdded++;
        onFeedAdded();
      }, onFeedAdded);
    });
  });

  function onFeedAdded() {
    feedsProcessed++;

    if(feedsProcessed < feeds.length) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'importFeedsCompleted',
      feedsAdded: feedsAdded,
      feedsProcessed: feedsProcessed,
      exceptions: exceptions
    });

    onComplete(feedsAdded, feedsProcessed, exceptions);
  }
}

// TODO: pass blob because nothing needs the intermediate string
function exportOPMLString(onComplete) {
  lucu.database.open(function (db) {
    lucu.feed.getAll(db, function (feeds) {
      var xmlDocument = lucu.opml.createDocument(feeds, 'subscriptions.xml');
      var serializer = new XMLSerializer();
      var str = serializer.serializeToString(xmlDocument);
      onComplete(str);
    });
  });
}

exports.lucu = exports.lucu || {};
exports.lucu.backup = {
  importOPMLFiles: importOPMLFiles,
  exportOPMLString: exportOPMLString
};

}(this));
