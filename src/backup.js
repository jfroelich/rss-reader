// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// TODO: think of a better name that captures both import and export
// Backup module

// TODO: this module, as a whole, needs alot of cleanup. There are a lot
// of nested functions and the continuation passing style is obscure.

lucu.backup = {};

/**
 * Calls onComplete with num feeds added, num feeds processed, and
 * array of exceptions
 */
lucu.backup.importOPMLFiles = function(files, onComplete) {

  // TODO: move onFileLoad out of here

  // TODO: decide whether to aggregate? We could just allow for add feed
  // to fail on dup and not try to even prevent it here.

  // TODO: rather than aggregate per file load, just combine into
  // a single large array and then aggregate at the end
  // TODO: the term hash is not really appropriate. What I want is
  // hashmap or hashset or just some concept like distinct or aggregated

  if(!files || !files.length) {
    onComplete(0, 0, []);
    return;
  }

  var exceptions = [];
  var fileCounter = files.length;

  var outlinesHash = {};

  var loadText = lucu.file.loadAsText.bind(null, onFileLoad);
  Array.prototype.forEach.call(files, loadText);

  function onFileLoad(event) {

    try {

      var xmlDocument = lucu.xml.parse(this.result);

    } catch(parseError) {

      // BUG?: exiting early means filecounter is never checked
      // leading to the continuation never being called

      return exceptions.push(parseError);
    }

    var outlines = lucu.opml.createOutlines(xmlDocument);

    // TODO: move this function out of here somehow
    // Aggregate feeds by url
    outlines.forEach(function(outline) {
      if(outline.url) {
        outlinesHash[outline.url] = outline;
      }
    });

    if(--fileCounter == 0) {
      var distinctFeeds = lucu.object.values(outlinesHash);
      lucu.backup.importFeeds(distinctFeeds, exceptions, onComplete);
    }
  }
};

lucu.backup.importFeeds = function(feeds, exceptions, onComplete) {
  var feedsProcessed = 0;
  var feedsAdded = 0;

  if(!feeds || !feeds.length) {
    return onComplete(feedsAdded, feedsProcessed, exceptions);
  }

  // TODO: this needs cleanup, externally defined functions
  lucu.database.open(function(db) {
    feeds.forEach(function(feed) {
      lucu.feed.add(db, feed, function() {
        feedsAdded++;
        onFeedAdded();
      }, onFeedAdded);
    });
  });

  // TODO: move this function out of here somehow
  function onFeedAdded() {
    feedsProcessed++;

    if(feedsProcessed >= feeds.length) {

      chrome.runtime.sendMessage({
        type: 'importFeedsCompleted',
        feedsAdded: feedsAdded,
        feedsProcessed: feedsProcessed,
        exceptions: exceptions
      });

      onComplete(feedsAdded, feedsProcessed, exceptions);
    }
  }
};

// TODO: this can go further and also create the blob because
// nothing needs the intermediate string
lucu.backup.exportOPMLString = function(onComplete) {

  lucu.database.open(onConnect);

  // TODO: move this function out of here
  function onConnect(db) {
    getAllFeeds(db, lucu.backup.serializeFeedsAsOPMLString.bind(null, onComplete));
  }
};

// TODO: think of a better name, like createOPMLStringFromFeeds

lucu.backup.serializeFeedsAsOPMLString = function(onComplete, feeds) {
  var xmlDocument = lucu.opml.createDocument(feeds,'subscriptions.xml');
  var serializer = new XMLSerializer();
  var str = serializer.serializeToString(xmlDocument);
  onComplete(str);
};
