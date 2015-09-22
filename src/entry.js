// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.entry = lucu.entry || {};


// TODO: some entry link URLs from feeds are pre-chain-of-redirect-resolution, 
// and are technically duplicates because each redirects to the same URL at the 
// end of the redirect chain. Therefore we should be storing the terminal link,
// not the source link. Or maybe we should be storing both. That way a lookup
// will detect the article already exists and we store fewer dups
// I think that fetching does use responseURL, but we end up not using response
// URL at some point later in processing. Basically, the responseURL has to be
// detected at the point of augment, and we want to rewrite at that point
// So this note is here but technically this note belongs to several issues in
// the holistic view of the update process. Maybe it does not belong to subscribe
// and only to poll because maybe only poll should be downloading and augmenting
// entries, and subscribe should just add the feed and not add any entries because
// subscribe should be near instant. So subscribe should store the feed and then
// enqueue a one-feed poll update.

lucu.entry.merge = function(database, feed, entry, callback) {
  'use strict';

  // TODO: is this check even necessary? Maybe this never happens?
  if(!entry.link) {
    console.warn('Not storing entry without link: %o', entry);
    callback();
    return;
  }

  var storable = {};
  
  if(feed.link) {
  	storable.feedLink = feed.link;
  }

  if(feed.title) {
  	storable.feedTitle = feed.title;
  }

  storable.feed = feed.id;
  storable.link = entry.link;
  storable.unread = 1;

  if(entry.author) {
    storable.author = entry.author;
  }

  if(entry.title) {
    storable.title = entry.title;
  }

  if(entry.pubdate) {
    var date = new Date(entry.pubdate);
    if(lucu.date.isValid(date)) {
      storable.pubdate = date.getTime();
    }
  }

  if(!storable.pubdate && feed.date) {
  	storable.pubdate = feed.date;
  }

  storable.created = Date.now();

  if(entry.content) {
  	storable.content = entry.content;
  }

  // Now insert the entry. Due to the unique flag on the entry.link index,
  // the transaction expectedly fails if the entry already exists.
  var transaction = database.transaction('entry', 'readwrite');
  var entryStore = transaction.objectStore('entry');
  var addEntryRequest = entryStore.add(storable);

  // Due to async.waterfall, we have to wrap callback to prevent it from
  // receiving an event parameter that async.waterfall would treat as 
  // an error argument.
  var onAddEntry = lucu.entry.onAddEntry.bind(addEntryRequest, callback);
  addEntryRequest.onsuccess = onAddEntry;
  addEntryRequest.onerror = onAddEntry;
};

lucu.entry.onAddEntry = function(callback, event) {
  'use strict';
  callback();
};

lucu.entry.markRead = function(entryId, callback, fallback) {
  'use strict';
  // console.log('Marking %s as read', entryId);
  var onConnect = lucu.entry.onMarkReadConnect.bind(null, entryId, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.entry.onMarkReadConnect = function(entryId, callback, error, database) {
  'use strict';
  var transaction = database.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  var entryStore = transaction.objectStore('entry');
  var markReadRequest = entryStore.openCursor(entryId);
  markReadRequest.onsuccess = lucu.entry.markReadUpdateEntry;
};

lucu.entry.markReadUpdateEntry = function(event) {
  'use strict';
  var cursor = event.target.result;
  if(!cursor) return;

  // Get the entry at the cursor. It may be possible that the entry somehow
  // no longer exists, so escape early when that is the case.
  var entry = cursor.value;
  if(!entry) return;

  // Suppress attempts to mark an entry as read if it is already read
  if(!entry.hasOwnProperty('unread')) {
  	// console.debug('Entry is already marked as read, suppressing');
  	return;
  }

  // Modify the entry
  delete entry.unread;
  entry.readDate = Date.now();
  cursor.update(entry);

  // console.debug('Marked %o as read', entry);

  // TODO: maybe instead of doing this here, we notify some type 
  // of 'app' observer that handles all of this? That decouples
  // the code a bit?

  // Update the unread count
  lucu.badge.update();

  // Notify observers that the entry was read
  // TODO: is anything listening to this? maybe deprecate?
  chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
};
