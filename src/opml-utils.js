// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: refactor like google-feeds.js

'use strict';

class OPMLUtils {

  // Imports an array of files representing OPML documents
  // (from the file browser window). Calls callback when 
  // complete. Import errors are logged but do not stop
  // the process.

  // TODO: I do not like how I am importing all of the files
  // and then importing all of the feeds. I can import one at a
  // time instead
  static importFiles(files, callback) {
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

      Database.open(function(event) {
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
      Notification.show(message);  
      callback();
    }
  }

  // Generates an OPMLDocument representing all feeds in the database
  // and passes it to the callback as the second argument. If an error
  // occurs, the first argument is set and represents the error object.
  static createDocument(title, callback) {
    const document = new OPMLDocument();
    document.setTitle(title);
    Database.open(function(event) {
      if(event.type !== 'success') {
        callback(event, document);
        return;
      }

      // NOTE: ES6 instance methods of classes appear to stored on the 
      // prototype, similar to traditional function objects
      FeedStore.forEach(event.target.result, 
        OPMLDocument.prototype.appendFeed.bind(document), 
        false, function() {
        callback(null, document);
      });
    });
  }
}
