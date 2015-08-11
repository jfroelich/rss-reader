// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: use augment ns

/**
 * Iterates over a feed's entries and replaces the html content property
 * of each entry with its full html according to its link. Forwards the
 * input feed to the callback.
 *
 * Entries that already exist within the local database are ignored.
 * If a database error occurs then no augmentation takes place and this
 * simply forwards the feed to the callback.
 *
 * TODO: change callback args so that conn.error can be set to callback?
 * TODO: use async.waterfall
 * TODO: use a common openDatabase function?
 */
lucu.augmentEntries = function(feed, callback) {
  'use strict';

  var conn = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  conn.onerror = function () {
    console.warn(error);
    callback(feed);
  };
  conn.onblocked = function () {
    console.warn(error);
    callback(feed);
  };
  conn.onsuccess = function () {
    var db = this.result;
    var tx = db.transaction('entry');
    async.reject(feed.entries, lucu.findEntryByLink.bind(this, tx),
      updateEntries);
  };

  function updateEntries(entries) {
    async.forEach(entries, lucu.updateEntryContent, function () {
      callback(feed);
    });
  }
};

/**
 * Searches for an entry by its link url property. Passes either the
 * matching entry object or undefined to the callback.
 * TODO: relocate this function?
 */
lucu.findEntryByLink = function(transaction, entry, callback) {
  'use strict';
  var store = transaction.objectStore('entry');
  var index = store.index('link');
  var url = entry.link;
  index.get(url).onsuccess = function() {
    callback(this.result);
  };
};

/**
 * Fetch the html at entry.link and use it to replace entry.content
 *
 * TODO: I'd prefer this function pass back any errors to the callback. This
 * would require the caller that wants to not break from async.forEach early
 * wrap the call.
 * TODO: consider embedding iframe content?
 * TODO: consider sandboxing iframes?
 * TODO: should entry timeout be a parameter? I want it somehow to be
 * declared external to this function
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
 * TODO: if pdf content type then maybe we embed iframe with src
 * to PDF? also, we should not even be trying to fetch pdfs? is this
 * just a feature of fetchHTML or does it belong here?
 * TODO: do something with responseURL?
 * TODO: I'd prefer this properly pass back errors to the callback and instead
 * require the caller to wrap this call in order to ignore such errors and
 * continue iteration if they want to use this function within the context of
 * async.forEach
 */
lucu.updateEntryContent = function(entry, callback) {
  'use strict';

  var entryTimeout = 20 * 1000;

  function onFetchError(error) {
    console.warn(error);
    callback();
  }

  var request = new XMLHttpRequest();
  request.timeout = entryTimeout;
  request.ontimeout = onFetchError;
  request.onerror = onFetchError;
  request.onabort = onFetchError;
  request.onload = function () {
    var document = this.responseXML;
    if(!document || !document.body) {
      console.debug('Cannot augment %s', this.responseURL);
      return callback();
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
