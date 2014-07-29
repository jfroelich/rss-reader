// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

lucu.entry = lucu.entry || {};

/**
 * TODO: maybe there is no need to use a hash, just use link, require link
 * for all entries?
 *
 * Merges zero or more entry objects into storage. Calls oncomplete
 * when finished, passing back the original feed argument, the
 * number of entries processed, and the number of entries added.
 *
 * Entries are added in separate transactions because otherwise any
 * one failure rolls back the entire set of addition requests.
 * Trying to add an entry whose hash value is the same
 * as any stored entry's hash value fails. This occurs frequently
 * because of how feeds are polled, in that feeds
 * usually contain the same articles for a long period of time but
 * the update checks occur over a much smaller interval. This produces
 * an expected failure that is not treated as a processing error.
 *
 * There is a race-like situation when trying to insert two or more
 * entries that produce the same hash. Insert requests are dispatched
 * concurrently. Whichever entry is processed first by indexedDB wins
 * the race. See https://bugs.webkit.org/show_bug.cgi?id=97570 for more
 * of an explanation. It is up to the caller to decide how to workaround
 * this issue. The issue is marginal because it is rare that a feed
 * contains duplicate entries. One workaround would be to pre-calculate
 * the hash, and then aggregate by hash, choosing to keep only the first,
 * only the last, or only the most informative of each group of entries.
 *
 * There is a rare scaling issue when inserting several thousand
 * entries that is not currently handled. For example, see
 * http://stackoverflow.com/questions/22247614.
 *
 * The caller should validate feed.id because the id is not validated and
 * an invalid id could lead to orphaned entries. The caller should prepare
 * entry content before merging because it is inserted "as is".
 *
 * @param db {IDBDatabase} - an open database connection
 * @param feed {object} - a feed object, such as one created as a result
 * of fetching the feed's XML and converting into a feed object
 * @param entries
 * @param oncomplete {function} - callback when completed
 */
lucu.entry.mergeAll = function(db, feed, entries, oncomplete) {

  var entriesAdded = 0;
  var entriesProcessed = 0;

  if(!entries) {
    // when addFeed is used by import opml or subscribe offline
    // then it is perfectly normal for entries to be undefined
    // in which case we are done
    return oncomplete(feed, entriesProcessed, entriesAdded);
  }

  var asStorableWithFeed = lucu.entry.asStorable.bind(this, feed);
  var storableEntries = entries.map(asStorableWithFeed);

  // Filter hashless entries. This also results in filtering
  // out entries that do not contain the required properties
  // for storage (either a link, a title, or content).
  storableEntries = storableEntries.filter(lucu.entry.hasHash);

  // Update entriesProcessed to reflect that we preprocessed some of
  // the entries when filtering
  entriesProcessed += entries.length - storableEntries.length;

  // This check for remaining entries must occur otherwise
  // oncomplete will never be called.
  if(entriesProcessed == entries.length) {
    return oncomplete(feed, entries.length, entriesAdded);
  }

  // TODO: to make this bindable and partial, storableEntry has to be
  // specified as the last argument
  storableEntries.forEach(function(storableEntry) {
    lucu.entry.add(db, storableEntry, onEntryInsertSuccessful, onEntryInsertAttempted);
  });

  // Basically we intervene before calling attempted in order to track added
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

// TODO: use something like
// Object.prototype.hasOwnProperty.bind(entry,'hash');
// instead, and then deprecate
lucu.entry.hasHash = function(entry) {
  return !!entry.hash;
};

lucu.entry.hasLink = function(entry) {
  return !!entry.link;
};

lucu.entry.rewriteLink = function(entry) {
  entry.link = lucu.rewrite.rewriteURL(entry.link);
};

/**
 * Create an object that is ready for storage in
 * the entries object store in indexedDB.
 *
 * Certain feed properties are propagated to the
 * entry.
 *
 * This also takes care of calculating the hash
 * value of the entry.
 *
 * NOTE: this is useful only for insert. This sets
 * entry.date-created to Date.now(), and does not
 * transfer properties such as entry.date-updated.
 */
lucu.entry.asStorable = function(feed, remoteEntry) {
  var output = {};

  if(feed.link) {
    output.feedLink = feed.link;
  }

  if(feed.title) {
    output.feedTitle = feed.title;
  }

  output.feed = feed.id;

  // Store a hash property for equality testing
  // and indexed lookup in indexedDB
  output.hash = lucu.entry.generateHash(remoteEntry);

  // Initialize as unread
  output.unread = 1;

  if(remoteEntry.author) {
    output.author = remoteEntry.author;
  }

  if(remoteEntry.link) {
    output.link = remoteEntry.link;
  }

  if(remoteEntry.title) {
    output.title = remoteEntry.title;
  }

  var publicationDate = lucu.date.parse(remoteEntry.pubdate);
  if(publicationDate) {
    output.pubdate = publicationDate.getTime();
  }

  if(!output.pubdate && feed.date) {
    output.pubdate = feed.date;
  }

  output.created = Date.now();

  // We are sanitizing, trimming, and rewriting/resolving urls in real time
  // on render instead of here.
  if(remoteEntry.content) {
    output.content = remoteEntry.content;
  }

  return output;
};

/**
 * Insert an entry into the database. Async. Calls
 * oncomplete when finished. Calls onerror if
 * an error occurred instead, such as a uniqueness
 * constraint violation (e.g. entry with same hash
 * already exists).
 */
lucu.entry.add = function(db, storableEntry, oncomplete, onerror) {
  var addTransaction = db.transaction('entry','readwrite');
  var addRequest = addTransaction.objectStore('entry').add(storableEntry);
  addRequest.onsuccess = oncomplete;
  addRequest.onerror = onerror;
};

lucu.entry.markAsRead = function(db, entryId, onComplete) {

  // TODO: intead of get/put, use openCursor and cursor.update

  var tx = db.transaction('entry','readwrite');
  tx.oncomplete = onComplete;
  var entryStore = tx.objectStore('entry');

  // TODO: move this function out of here

  entryStore.get(entryId).onsuccess = function() {
    var entry = this.result;
    if(!entry)
      return;

    delete entry.unread;
    entry.readDate = Date.now();
    entryStore.put(entry);
    chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
  };
};


/**
 * Removes all entries from the entry store with the given
 * feedId and then calls oncomplete. Passes a count of the
 * removed entries to the oncomplete function.
 *
 * Note: unlike several of the other storage-related functions, this
 * expects a transaction instead of a database connection because
 * the function is intended to possibly be a part of the same transaction
 * that deletes a feed, in order to enforce referential integrity
 * between feeds and entries. Otherwise a situation could arise where
 * the feed is deleted but not the entries, leading to entries with
 * a feed property that points to a non-existant feed, which is known
 * as orphaning. Upfront enforcement of the integrity is preferred
 * to later polling and storage health monitoring for orphaned feeds
 * In other words, this is defensively designed (without being too
 * defensive).
 *
 * NOTE: this calls oncomplete BEFORE the individual delete requests
 * may have completed. This function merely fires off a bunch of delete
 * requests using the transaction. Therefore, count is not really
 * valid until the transaction itself completes. oncomplete here
 * means the completion of firing off the delete operations, not
 * the actual, eventual commit of those individual requests. This is
 * preferred to blocking per request.
 *
 * object stores have a delete method that can accept a key range, doing
 * a batch delete of all objects in the key range. But indices do not have a
 * delete method. Therefore, to do the deletes via a single method this would
 * only work if the
 * entries were stored contiguously in the object store because that is
 * the only way to create a range over just those particular entries.
 * It is impossible to ensure entries are stored contiguously in the
 * current design because the order in which entries from different feeds
 * are inserted is pretty much random and uncontrollable. Using a single
 * entry store in this way makes enforcing this order nonsensical.
 */
lucu.entry.removeByFeed = function(tx, feedId, oncomplete) {

  var count = 0;
  var entryStore = tx.objectStore('entry');
  var feedIndex = entryStore.index('feed');

  // This method performs three micro optimizations: (1) uses key cursor
  // instead of a normal cursor, (2) uses a primitive-like parameter to
  // openKeyCursor instead of explicitly and unecessarily creating a new
  // IBDKeyRange, and (3) uses cursor.delete instead of a subsequent call
  // to store.delete.



  var requestKeyCursor = feedIndex.openKeyCursor(feedId);

  // TODO: move the function out of here
  requestKeyCursor.onsuccess = function() {
    var keyCursor = this.result;
    if(keyCursor) {
      entryStore.delete(keyCursor.primaryKey);
      count++;
      keyCursor.continue();
    } else {
      oncomplete(count);
    }
  };
};

/**
 * Creates a hash value for an entry. This is what ultimately
 * determines whether two entries are equal. This has undergone
 * several revisions. In the current version, we basically consider
 * two entries to be the same if they share the same link,
 * title, or content.
 *
 * Returns undefined if there was no suitable seed to input to
 * the hashCode function.
 */
lucu.entry.generateHash = function(remoteEntry) {
  var seed = remoteEntry.link || remoteEntry.title || remoteEntry.content;
  if(seed) {
    return lucu.hash.generate(seed.split(''));
  }
};

/**
 * Finds the first entry that contains the given url in its
 * link property and then passes to this callback. Otherwise
 * undefined is passed to the callback.
 *
 * This is used when fetching full text of articles to avoid
 * refetching.
 */
lucu.entry.findByLink = function(db, link, callback) {
  var entryStore = db.transaction('entry').objectStore('entry');
  var linkIndex = entryStore.index('link');
  linkIndex.get(link).onsuccess = function() {
    callback(this.result);
  };
};
