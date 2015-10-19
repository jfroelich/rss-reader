// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.entry = lucu.entry || {};

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
lucu.entry.put = function(connection, feed, entry, callback) {
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
    const date = new Date(entry.pubdate);
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
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = function() { 
    callback(); 
  };
  transaction.objectStore('entry').add(storable);
};

// TODO: provide a callback?
lucu.entry.markRead = function(connection, id) {
  'use strict';
  // console.log('Marking %s as read', id);

  const transaction = connection.transaction('entry', 'readwrite');
  //transaction.oncomplete = callback;
  const entries = transaction.objectStore('entry');
  const request = entries.openCursor(id);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(!cursor) {
      return;
    }
    
    const entry = cursor.value;
    if(!entry) {
      return;
    }
    
    if(!entry.hasOwnProperty('unread')) {
      return;
    }
    
    delete entry.unread;
    entry.readDate = Date.now();
    cursor.update(entry);
    lucu.browser.updateBadge();
    //chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
  };
};

// Returns a truthy value if the entry has a link property with a value
lucu.entry.hasLink = function(entry) {
  'use strict';
  return entry.link;
};

lucu.entry.rewriteLink = function(entry) {
  'use strict';
  entry.link = lucu.url.rewrite(entry.link);
};

// Searches for entry.link in the link index
lucu.entry.findByLink = function(connection, entry, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entry.link);
  request.onsuccess = callback;
};

lucu.entry.removeByFeed = function(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = store.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(feedId);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
};

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
lucu.entry.augment = function(entry, callback) {
  'use strict';
  
  const request = new XMLHttpRequest();
  request.timeout = 20 * 1000;
  const onError = function(event) {
    console.warn(event);
    callback();
  };
  request.ontimeout = onError;
  request.onerror = onError;
  request.onabort = onError;
  
  request.onload = function(event) {
    const request = event.target;
    const document = request.responseXML;

    if(!document || !document.body) {
      callback();
      return;
    }

    lucu.url.resolveDocument(document, request.responseURL);

    const images = document.body.getElementsByTagName('img');
    async.forEach(images, lucu.images.fetchDimensions, function() {
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
};

lucu.entry.clearEntries = function(connection) {
  'use strict';
  const transaction = connection.transaction('entry', 'readwrite');
  const entries = transaction.objectStore('entry');
  const request = entries.clear();
  request.onerror = console.debug;
  request.onsuccess = function(event) {
    console.debug('Cleared entry object store');
  };
};
