// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Calls onComplete with num feeds added, num feeds processed, and
 * array of exceptions
 */
function importOPMLFiles(files, onComplete) {

  var exceptions = [];

  if(!files || !files.length) {
    onComplete(0, 0, exceptions);
    return;
  }

  var fileCounter = files.length;

  // TODO: decide whether to aggregate? We could just allow for add feed
  // to fail on dup and not try to even prevent it here.

  // TODO: rather than aggregate per file load, just combine into
  // a single large array and then aggregate at the end
  // TODO: the term hash is not really appropriate. What I want is
  // hashmap or hashset or just some concept like distinct or aggregated
  var outlinesHash = {};

  Array.prototype.forEach.call(files, loadFileAsText.bind(null, onFileLoad));

  // TODO: move this function out of here
  function onFileLoad(event) {

    try {

      var xmlDocument = parseXML(this.result);

    } catch(parseError) {

      // BUG?: exiting early means filecounter is never checked
      // leading to the continuation never being called

      return exceptions.push(parseError);
    }

    var outlines = createOutlinesFromOPMLDocument(xmlDocument);

    // TODO: move this function out of here somehow
    // Aggregate feeds by url
    outlines.forEach(function(outline) {
      if(outline.url) {
        outlinesHash[outline.url] = outline;
      }
    });

    if(--fileCounter == 0) {
      var distinctFeeds = lucu.objectUtils.values(outlinesHash);
      importFeeds(distinctFeeds, exceptions, onComplete);
    }
  }
}

// TODO: move this function into some other file where it is more appropriate
// like file-utils
function loadFileAsText(onFileLoad, file) {
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

  // TODO: this needs cleanup, externally defined functions
  openIndexedDB(function(db) {
    feeds.forEach(function(feed) {
      addFeed(db, feed, function() {
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
}

// TODO: this can go further and also create the blob because
// nothing needs the intermediate string
function exportOPMLString(onComplete) {

  openIndexedDB(onConnect);

  // TODO: move this function out of here
  function onConnect(db) {
    getAllFeeds(db, serializeFeedsAsOPMLString.bind(null, onComplete));
  }
}

// TODO: think of a better name, like createOPMLStringFromFeeds

function serializeFeedsAsOPMLString(onComplete, feeds) {
  var xmlDocument = createOPMLDocument(feeds,'subscriptions.xml');
  var serializer = new XMLSerializer();
  var str = serializer.serializeToString(xmlDocument);
  onComplete(str);
}
