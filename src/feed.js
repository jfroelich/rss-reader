// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

// Finds a feed by url, ignoring scheme
// NOTE: requires URI.js
lucu.feed.findByURL = function(url, callback) {
  'use strict';
  var onConnect = lucu.feed.findByURLOnConnect.bind(null, url, callback);
  lucu.database.connect(onConnect, console.error);
};

lucu.feed.findByURLOnConnect = function(url, callback, error, database) {
  'use strict';

  var transaction = database.transaction('feed');
  var feeds = transaction.objectStore('feed');
  var index = feeds.index('schemeless');

  var uri = new URI(url);
  uri.protocol('');
  var schemeless = uri.toString().substring(2);

  var request = index.get(schemeless);
  request.onsuccess = lucu.feed.findByURLOnSuccess.bind(request, callback);
};

lucu.feed.findByURLOnSuccess = function(callback, event) {
  'use strict';
  var feed = event.target.result;
  callback(feed);
};


/*
  function onConnect(error, database) {
    var store = database.transaction('feed').objectStore('feed');
    var index = store.index('schemeless');
    var uri = new URI(url);
    uri.protocol('');
    var schemeless = uri.toString().substring(2);
    var findRequest = index.get(schemeless);
    findRequest.onsuccess = function() {
      var existingFeed = this.result;
      if(existingFeed) {
        return hideSubsciptionMonitor(function() {
          showErrorMessage('Already subscribed to ' + url + '.');
        });
      }

      // TODO: use connectivity.js lib
      if(!navigator.onLine) {
        return lucu.addFeed(database, {url: url}, onSubscriptionSuccessful, 
          console.debug);
      }

      lucu.fetch.fetchFeed(url, onFetchComplete, onFetchError, 10 * 1000);
    };
  };
*/