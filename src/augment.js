// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Feed augmentation lib
lucu.augment = {};

/**
 * Iterates over a feed's entries and replaces the html content property
 * of each entry with its full html according to its link. Forwards the
 * input feed to the callback.
 *
 * Entries that already exist within the local database are ignored.
 * If a database error occurs then no augmentation takes place and this
 * simply forwards the feed to the callback.
 */
lucu.augment.start = function(feed, callback) {
  console.debug('Augmenting %s entries', feed.entries.length);
  var waterfall = [
    lucu.augment.connect,
    lucu.augment.filterExisting.bind(null, feed.entries),
    lucu.augment.updateEntries
  ];
  async.waterfall(waterfall, 
    lucu.augment.onComplete.bind(null, feed, callback));
};

lucu.augment.connect = function(callback) {
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = lucu.augment.onConnect.bind(request, callback);
};

lucu.augment.onConnect = function(callback, event) {
  callback(null, event.target.result);
};

// Asynchronously iterate over the entries to produce an array of 
// only those entries not already in the database and then pass 
// along this array
lucu.augment.filterExisting = function(entries, db, callback) {
  // console.debug('Augment - filtering %s entries', entries.length);
  var tx = db.transaction('entry');
  var findByLink = lucu.augment.findEntryByLink.bind(this, tx);
  var onComplete = lucu.augment.onFilteredExisting.bind(null, callback);
  async.reject(entries, findByLink, onComplete);
};

lucu.augment.onFilteredExisting = function(callback, entries) {
  console.debug('Augment, after filter there are %s entries remaining', entries.length);
  callback(null, entries);
};

lucu.augment.findEntryByLink = function(transaction, entry, callback) {
  'use strict';
  var store = transaction.objectStore('entry');
  var index = store.index('link');
  var url = entry.link;
  // console.debug('Augment - findEntryByLink %s', url);
  var request = index.get(url);
  request.onsuccess = lucu.augment.onFindEntry.bind(request, callback);
};

lucu.augment.onFindEntry = function(callback, event) {
  callback(event.target.result);
};

lucu.augment.updateEntries = function(entries, callback) {
  // console.debug('Augment updateEntries %s entries', entries.length);
  async.forEach(entries, lucu.updateEntryContent, function () {
    callback();
  });
};

lucu.augment.FETCH_TIMEOUT = 20 * 1000;

lucu.augment.updateEntryContent = function(entry, callback) {
  'use strict';

  console.debug('Augmenting entry %s', entry.link);

  function onFetchError(error) {
    console.warn(error);
    callback();
  }

  var request = new XMLHttpRequest();
  request.timeout = lucu.augment.FETCH_TIMEOUT;
  request.ontimeout = onFetchError;
  request.onerror = onFetchError;
  request.onabort = onFetchError;
  request.onload = function () {
    var document = this.responseXML;
    if(!document || !document.body) {
      console.debug('Cannot augment %s', this.responseURL);
      callback();
      return;
    }

    lucu.resolver.resolveDocument(document, this.responseURL);

    var images = document.body.getElementsByTagName('img');
    async.forEach(images, lucu.images.fetchDimensions, function () {
      entry.content = document.body.innerHTML ||
        'Unable to download content for this article';
      callback();
    });
  };
  request.open('GET', entry.link, true);
  request.responseType = 'document';
  request.send();  
};

lucu.augment.onComplete = function(feed, callback) {
  callback(feed);
};
