// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * TODO: dont forget to include
 *
 * Passes an array of entries that do not already exist in the local
 * database to the callback.
 *
 * NOTE: assumes entry.link has already been processed by lucu.rewriteURL
 * NOTE: still need to design how to handle redirects. For now this
 * ignores the post-redirect-url of each entry because it is assumed
 * to not be available
 * NOTE: i sort of do no like how this basically blocks until all
 * entries have been filtered. each can be asynchrnously checked
 * as separate requests in the same transaction. or we could have
 * separate conn+tx+request tuple for every check, so that every
 * check is fully async and completes and continues independently
 * of the other checks
 * NOTE: the other thing I dont like is how this doesnt consider
 * errors, like database errors. it needs to be more resilient. this
 * applies to pretty much all of the queries throughout the app
 * NOTE: the other thing i dont like is using openDatabase. I am
 * not sure I need this extra layer of indirection. There is no
 * alternative to indexedDB, there is no other storage mechanism
 * that will ever be substituted in that will yield the same
 * behavior. So why wrap? Not every connect call needs the
 * on upgrade needed callback
 */
lucu.filterExistingEntries = function(entries, callback) {
  'use strict';

  var output = [];

  // Expects caller guarantee entries is defined

  // TODO: what about filtering entries without links? Should
  // caller be doing this or do we do this?

  var numEntries = entries.length;

  // Exit early and ensure continuation
  if(!numEntries) {
    return callback(output);
  }

  // TODO: onerror/blocked, ensure callback still called?

  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;
    entries.forEach(function checkEntry(entry) {
      lucu.entry.findByLink(db, entry.link, function onFind(exists) {
        if(!exists) output.push(entry);
        numEntries--;
        if(!numEntries) callback(output);
      });
    });
  };
};
