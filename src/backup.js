// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Calls onComplete with num feeds added, num feeds processed, and
 * array of exceptions
 *
 * TODO: just allow for add feed to fail on dup instead of agg?
 * TODO: rather than agg per file, agg at the end?
 */
lucu.importOPMLFiles = function(files, onComplete) {
  'use strict';
  if(!files || !files.length) {
    return onComplete(0, 0, []);
  }

  var exceptions = [];
  var fileCounter = files.length;

  // TODO: use a Map instead

  var outlinesHash = {};
  var forEach = Array.prototype.forEach;

  forEach.call(files, function (file) {
    var reader = new FileReader();
    reader.onload = function(event) {
      try {
        var xmlDocument = lucu.parseXML(this.result);
      } catch(parseError) {
        exceptions.push(parseError);
      }

      if(xmlDocument) {
        var outlines = lucu.createOPMLOutlines(xmlDocument);
        outlines.forEach(function(outline) {
          if(outline.url) {
            outlinesHash[outline.url] = outline;
          }
        });
      }

      fileCounter--;
      if(fileCounter) return;

      var feeds = Object.keys(outlinesHash).filter(function(key) {
        return outlinesHash.hasOwnProperty(key);
      }).map(function(key) {
        return outlinesHash[key];
      });

      if(!feeds.length) {
        return onComplete(0, 0, exceptions);
      }

      var feedsAdded = 0, feedsProcessed = 0;

      lucu.openDatabase(function (event) {
        var db = event.target.result;
        feeds.forEach(function(feed) {
          lucu.feed.add(db, feed, function () {
            feedsAdded++;
            onFeedProcessed();
          }, onFeedProcessed);
        });
      });

      function onFeedProcessed() {
        feedsProcessed++;
        if(feedsProcessed < feeds.length) return;

        chrome.runtime.sendMessage({
          type: 'importFeedsCompleted',
          feedsAdded: feedsAdded,
          feedsProcessed: feedsProcessed,
          exceptions: exceptions
        });

        onComplete(feedsAdded, feedsProcessed, exceptions);
      }
    };

    reader.readAsText(file);
  });
};

// TODO: pass blob because nothing needs the intermediate string
lucu.exportOPMLString = function(onComplete) {
  'use strict';
  lucu.openDatabase(function (event) {
    var db = event.target.result;
    lucu.feed.getAll(db, function (feeds) {
      var xmlDocument = lucu.createOPMLDocument(feeds, 'subscriptions.xml');
      var serializer = new XMLSerializer();
      var str = serializer.serializeToString(xmlDocument);
      onComplete(str);
    });
  });
};
