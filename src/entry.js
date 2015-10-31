// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

const ENTRY_UNREAD = 0;
const ENTRY_READ = 1;
const ENTRY_UNARCHIVED = 0;
const ENTRY_ARCHIVED = 1;

// TODO: create an Entry data object, store entry objects instead of generic
// object literals in indexedDB. Attach appropriate methods to the general
// object. This should lead to much cleaner looking and organized code.
// In doing so, review the structured clone algorithm that indexedDB uses
// to ensure that add/get works as expected.

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

// TODO: feed should not be a parameter here. the cascading of feed property to 
// entry properties should occur externally.

function putEntry(connection, feed, entry, callback) {
  'use strict';
  
  console.debug('Putting entry %s', entry.link);

  const storable = {};
  
  if(entry.hasOwnProperty('feedLink')) {
    storable.feedLink = entry.feedLink;
  } else {
    if(feed.link) {
      storable.feedLink = feed.link;
    }
  }

  if(entry.hasOwnProperty('feedTitle')) {
    storable.feedTitle = entry.feedTitle;
  } else {
    if(feed.title) {
      storable.feedTitle = feed.title;
    }
  }

  if(entry.hasOwnProperty('feed')) {
    storable.feed = entry.feed;
  } else {
    storable.feed = feed.id;
  }

  if(entry.link) {
    storable.link = entry.link;
  }

  if(entry.hasOwnProperty('readState')) {
    storable.readState = entry.readState;
  } else {
    storable.readState = ENTRY_UNREAD;
  }

  if(entry.hasOwnProperty('readDate')) {
    storable.readDate = entry.readDate;
  }

  if(entry.author) {
    storable.author = entry.author;
  }
  if(entry.title) {
    storable.title = entry.title;
  }

  if(entry.pubdate) {
    const date = new Date(entry.pubdate);
    if(isValidDate(date)) {
      storable.pubdate = date.getTime();
    }
  }
  if(!storable.pubdate && feed.date) {
  	storable.pubdate = feed.date;
  }
  
  if(entry.hasOwnProperty('created')) {
    storable.created = entry.created;
  } else {
    storable.created = Date.now();
  }

  if(entry.content) {
  	storable.content = entry.content;
  }

  if(entry.hasOwnProperty('archiveState')) {
    storable.archiveState = entry.archiveState;
  } else {
    // Ensure that archiveState has a default value so that 
    // index picks up entries
    storable.archiveState = ENTRY_UNARCHIVED;
  }

  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = function() { 
    callback(); 
  };
  transaction.objectStore('entry').add(storable);
}

function markEntryRead(connection, id) {
  'use strict';
  console.debug('Marking entry %s as read', id);
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(id);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(!cursor) {
      return;
    }
    const entry = cursor.value;
    if(!entry) {
      return;
    }

    // Do not re-mark read entries
    if(entry.readState === ENTRY_READ) {
      return;
    }

    // Update the entry
    entry.readState = ENTRY_READ;
    entry.readDate = Date.now();
    cursor.update(entry);

    // Notify observers and app state
    updateBadge();
    chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
  };
}

function findEntryByLink(connection, entry, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entry.link);
  request.onsuccess = callback;
}

function removeEntriesByFeed(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = store.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(id);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}

/**
 * Fetch the html at entry.link and use it to replace entry.content
 *
 * TODO: I'd prefer this function pass back any errors to the callback. This
 * would require the caller that wants to not break from async.forEach early
 * wrap the call.
 * TODO: consider embedding/sandboxing iframes?
 * TODO: should timeout be a parameter?
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
 * TODO: if pdf content type then maybe we embed iframe with src
 * to PDF? also, we should not even be trying to fetch pdfs? is this
 * just a feature of fetchHTML or does it belong here?
 * TODO: do something with responseURL?
 */
function augmentEntryContent(entry, timeout, callback) {
  'use strict';
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = callback;
  request.onerror = callback;
  request.onabort = callback;
  request.onload = function(event) {
    const request = event.target;
    const document = request.responseXML;
    if(!document || !document.body) {
      callback(new Error('No document'));
      return;
    }

    resolveURLs(document, request.responseURL);

    const images = document.body.getElementsByTagName('img');
    async.forEach(images, fetchImageDimensions, function() {
      const content = document.body.innerHTML;
      if(content) {
        entry.content = content;
      } else {
        entry.content = 'Unable to download content for this article';
      }
      callback();
    });
  };

  request.open('GET', entry.link, true);
  request.responseType = 'document';
  request.send();  
}

// TODO: think of a better way to specify the proxy. I should not be
// relying on window explicitly here.
// TODO: if this is only a helper function, move it into its sole context
function fetchImageDimensions(image, callback) {
  'use strict';
  const src = (image.getAttribute('src') || '').trim();
  const width = (image.getAttribute('width') || '').trim();
  if(!src || width || image.width || width === '0' || 
    /^0\s*px/i.test(width) || isDataURI(src)) {
    return callback();
  }

  const document = window.document;
  const proxy = document.createElement('img');
  proxy.onload = function(event) {
    const proxy = event.target;
    image.width = proxy.width;
    image.height = proxy.height;
    callback();
  };
  
  proxy.onerror = function(event) {
    callback();
  };
  proxy.src = src;
}

function clearEntries(connection) {
  'use strict';
  const transaction = connection.transaction('entry', 'readwrite');
  const entries = transaction.objectStore('entry');
  const request = entries.clear();
  request.onerror = console.debug;
  request.onsuccess = function(event) {
    console.debug('Cleared entry object store');
  };
}
