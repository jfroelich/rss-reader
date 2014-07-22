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
  var outlinesHash = {};

  Array.prototype.forEach.call(files, loadFileAsText.bind(null, onFileLoad));

  function onFileLoad(event) {

    try {

      var xmlDocument = parseXML(this.result);

    } catch(parseError) {

      // BUG?: exiting early means filecounter is never checked
      // leading to the continuation never being called

      return exceptions.push(parseError);
    }

    var outlines = createOutlinesFromOPMLDocument(xmlDocument);

    // Aggregate feeds by url
    outlines.forEach(function(outline) {
      if(outline.url) {
        outlinesHash[outline.url] = outline;
      }
    });

    if(--fileCounter == 0) {
      var distinctFeeds = objectValues(outlinesHash);
      importFeeds(distinctFeeds, exceptions, onComplete);
    }
  }
}

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

  openIndexedDB(function(db) {
    feeds.forEach(function(feed) {
      addFeed(db, feed, function() {
        feedsAdded++;
        onFeedAdded();
      }, onFeedAdded);
    });
  });

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

// Useful for creating input to Blob in UI Save As code
// TODO: this can go further and also create the blob because
// nothing needs the intermediate string
function exportOPMLString(onComplete) {

  openIndexedDB(function(db) {
    getAllFeeds(db, onGetAllFeeds);
  });

  function onGetAllFeeds(feeds) {
    var xmlDocument = createOPMLDocument(feeds,'subscriptions.xml');
    var serializer = new XMLSerializer();
    var str = serializer.serializeToString(xmlDocument);
    onComplete(str);
  }
}
