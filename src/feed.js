// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.addFeed = function(db, feed, onComplete, onerror) {
  'use strict';
  // TODO: use the async's approach to error handling. Only use
  // one callback. The first argument should be the error object.
  var storable = {};
  storable.url = feed.url;
  var schemeless = new URI(storable.url);
  schemeless.protocol('');
  storable.schemeless = schemeless.toString().substring(2);
  var clean = lucu.sanitizeFeed(feed);
  // TODO: title must be somehow defined or else it wont be returned
  // when sorting by title in forAllFeeds in the options page. This should
  // eventually be improved.
  storable.title = clean.title || '';
  if(clean.description)
    storable.description = clean.description;
  if(clean.link) storable.link =  clean.link;
  if(clean.date) storable.date = clean.date;
  if(feed.fetched) storable.fetched = feed.fetched;
  storable.created = Date.now();
  // Triggers onerror when schemeless already exists
  var tx = db.transaction('feed','readwrite');
  var feedStore = tx.objectStore('feed');
  var request = feedStore.add(storable);
  request.onerror = onerror;
  request.onsuccess = function() {
    storable.id = this.result;
    lucu.mergeEntries(db, storable, feed.entries, onComplete);
  };
};

/**
 * Returns a sanitized copy of dirtyFeed.
 *
 * TODO: deal with html entities in strings
 */
lucu.sanitizeFeed = function(dirtyFeed) {
  'use strict';
  function sanitizeString(str) {
    if(!str) return;
    str = lucu.stripTags(str);
    if(str) str = lucu.stripControls(str);
    // TODO: this should be a call to a separate function
    // or maybe merged with lucu.string.stripControls
    // (one pass instead of two)
    if(str) str = str.replace(/\s+/,' ');
    if(str) str = str.trim();
    return str;
  }

  var cleanFeed = {};

  var title = sanitizeString(dirtyFeed.title);
  if(title) {
    cleanFeed.title = title;
  }

  var description = sanitizeString(dirtyFeed.description);
  if(description) {
    cleanFeed.description = description;
  }

  var link = sanitizeString(dirtyFeed.link);
  if(link) {
    cleanFeed.link = link;
  }

  if(dirtyFeed.date) {
    cleanFeed.date = dirtyFeed.date;
  }

  return cleanFeed;
};

lucu.mergeEntries = function(db, feed, entries, oncomplete) {
  'use strict';
  function parseDate(str) {
    if(!str) return;
    var date = new Date(str);
    if(Object.prototype.toString.call(date) != '[object Date]') return;
    if(!isFinite(date)) return;
    return date;
  }

  function appendHash(sum, string) {
    return (sum * 31 + string.charCodeAt(0)) % 4294967296;
  }

  var entriesAdded = 0, entriesProcessed = 0;

  if(!entries) {
    return oncomplete(feed, entriesProcessed, entriesAdded);
  }

  var storableEntries = entries.map(function (entry) {
    var output = {};
    if(feed.link) output.feedLink = feed.link;
    if(feed.title) output.feedTitle = feed.title;
    output.feed = feed.id;
    // TODO: just use entry.link as key
    // Store a hash property for equality testing
    // and indexed lookup in indexedDB
    var seed = entry.link || entry.title ||
      remoteEntry.content || '';
    output.hash = seed.split('').reduce(appendHash, 0);
    output.unread = 1;
    if(entry.author) output.author = entry.author;
    if(entry.link) output.link = entry.link;
    if(entry.title) output.title = entry.title;
    var publicationDate = parseDate(entry.pubdate);
    if(publicationDate) output.pubdate = publicationDate.getTime();
    if(!output.pubdate && feed.date) output.pubdate = feed.date;
    output.created = Date.now();
    if(entry.content) output.content = entry.content;
    return output;
  });

  // Filter hashless entries. This also results in filtering
  // out entries that do not contain the required properties
  // for storage (either a link, a title, or content).
  storableEntries = storableEntries.filter(function (entry) {
    return entry.hash;
  });

  // Update entriesProcessed to reflect that we preprocessed some of
  // the entries when filtering
  entriesProcessed += entries.length - storableEntries.length;

  // This check for remaining entries must occur otherwise
  // oncomplete will never be called.
  if(entriesProcessed == entries.length) {
    return oncomplete(feed, entries.length, entriesAdded);
  }

  // TODO: use async.each here
  storableEntries.forEach(function(storableEntry) {
    var tx = db.transaction('entry','readwrite');
    var request = tx.objectStore('entry').add(storableEntry);
    request.onsuccess = onEntryInsertSuccessful;
    request.onerror = onEntryInsertAttempted;
  });

  function onEntryInsertSuccessful() {
    entriesAdded++;
    onEntryInsertAttempted();
  }

  // Called when an entry was eventually added, which could be the result
  // of a successful addition or the result of an error. Really just
  // waiting to see if we processed everything. We have to do this instead of
  // using tx.oncomplete because entries are inserted in separate transactions,
  // because grouping into the same tx is semantically inaccurate and also does
  // not work because some requests are expected to fail when the hash uniqueness
  // constraint is violated which due to the way idb is designed would roll
  // back the entire tx.
  function onEntryInsertAttempted() {
    if(++entriesProcessed >= entries.length) {
      oncomplete(feed, entries.length, entriesAdded);
    }
  }
};
