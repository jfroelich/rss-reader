// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: split into two functions and two files
// TODO: create import-opml.js, importOPML function
// TODO: create export-opml.js, exportOPML function

'use strict';

// Utility functions for OPML features
// TODO: rename to OPMLIO, opml-io.js
// TODO: drop the named object, just export two global functions

// TODO: explicit dependencies on OPMLDocument, openIndexedDB, async,
// showNotification, FeedStore

// TODO: the two functions are somewhat related, but i think they may
// as well be in separate files named after each function

const OPMLUtils = {};

{ // BEGIN ANONYMOUS NAMESPACE

// Imports an array of files representing OPML documents
// (from the file browser window). Calls callback when
// complete. Import errors are logged but do not stop
// the process.
// TODO: I do not like how I am importing all of the files
// and then importing all of the feeds. I can import one at a
// time instead
OPMLUtils.importFiles = function(files, callback) {
  async.map(files, loadFile, onFilesLoaded);

  function loadFile(file, callback) {
    const reader = new FileReader();
    reader.onload = onFileLoad.bind(reader, callback);
    reader.onerror = onFileError.bind(reader, callback);
    reader.readAsText(file);
  }

  function onFileError(callback, event) {
    callback(null, []);
  }

  function onFileLoad(callback, event) {
    const reader = event.target;
    const text = reader.result;
    let document = null;
    let feeds = [];
    try {
      document = OPMLDocument.parse(text);
      feeds = document.getFeeds();
    } catch(exception) {
      console.debug(exception);
    }
    callback(null, feeds);
  }

  function onFilesLoaded(error, feedArraysArray) {

    const feedMap = new Map();
    feedArraysArray.forEach(function(feedArray) {
      feedArray.forEach(function(feed) {
        if(feed.url) {
          feedMap.set(feed.url, feed);
        }
      });
    });

    // TODO: maybe instead of converting back to
    // an array, modify storeFeeds to expect
    // an iterable
    const feeds = [...feedMap.values()];

    if(!feeds.length) {
      onImportComplete('No valid feeds found');
      return;
    }

    openIndexedDB(function(event) {
      if(event.type !== 'success') {
        console.debug(event);
        onImportComplete(event);
        return;
      }

      storeFeeds(event.target.result, feeds);
    });
  }

  function storeFeeds(connection, feeds) {
    async.forEach(feeds, function(feed, callback) {
      FeedStore.put(connection, null, feed, callback);
    }, onImportComplete);
  }

  function onImportComplete(error) {
    const message = 'Imported OPML file(s)';
    showNotification(message);
    callback();
  }
};

// Generates an OPMLDocument representing all feeds in the database
// and passes it to the callback as the second argument. If an error
// occurs, the first argument is set and represents the error object.
OPMLUtils.createDocument = function(title, callback) {
  const document = new OPMLDocument();
  document.setTitle(title);
  openIndexedDB(createDocumentOnConnect.bind(null, document, callback));
};

function createDocumentOnConnect(document, callback, event) {
  if(event.type !== 'success') {
    callback(event, document);
    return;
  }

  // Load and append each feed to the document
  FeedStore.forEach(event.target.result,
    OPMLDocument.prototype.appendFeed.bind(document),
    false,
    createDocumentOnFeedsIterated.bind(null, document, callback));
}

// Pass the document along to the callback
function createDocumentOnFeedsIterated(document, callback) {
  callback(null, document);
}

} // END ANONYMOUS NAMESPACE
