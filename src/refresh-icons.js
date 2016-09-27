// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.refreshIcons = {};

// Refresh the favicon for feeds
rdr.refreshIcons.start = function(verbose) {
  if(verbose) {
    console.debug('Refreshing feed favicons...');
  }

  const ctx = {
    'verbose': verbose,
    'pendingCount': 0
  };

  rdr.db.open(rdr.refreshIcons._onOpenDB.bind(ctx));
};

rdr.refreshIcons._onOpenDB = function(db) {

  if(!db) {
    if(this.verbose) {
      console.error('Failed to connect to database');
    }

    rdr.refreshIcons._onComplete.call(this);
    return;
  }

  this.db = db;
  rdr.feed.getAll(db, rdr.refreshIcons._onGetAllFeeds.bind(this));
};

rdr.refreshIcons._onGetAllFeeds = function(feeds) {
  // This will be decremented as each feed is processed
  this.pendingCount = feeds.length;
  if(!this.pendingCount) {
    if(this.verbose) {
      console.debug('No feeds found');
    }

    rdr.refreshIcons._onComplete.call(this);
    return;
  }

  for(let feed of feeds) {
    rdr.refreshIcons._lookup.call(this, feed);
  }
};

// Lookup the favicon for a feed
rdr.refreshIcons._lookup = function(feed) {

  // Get the lookup url for the feed. Prefer the link because it is a
  // website associated with the feed. Otherwise fall back to using the
  // domain of the url to the feed's xml file.
  // None of the parsing should throw.
  let lookupURL = null;
  if(feed.link) {
    lookupURL = new URL(feed.link);
  } else {
    const feedURLObject = new URL(rdr.feed.getURL(feed));
    lookupURL = new URL(feedURLObject.origin);
  }

  const doc = null;
  rdr.favicon.lookup(lookupURL, doc, this.verbose,
    rdr.refreshIcons._onLookup.bind(this, feed));
};

rdr.refreshIcons._onLookup = function(feed, faviconURL) {
  if(faviconURL) {
    if(!feed.faviconURLString || feed.faviconURLString !== faviconURL.href) {
      if(this.verbose) {
        console.debug('Setting feed %s favicon to %s',
          rdr.feed.getURL(feed), faviconURL.href);
      }

      feed.faviconURLString = faviconURL.href;
      feed.dateUpdated = new Date();

      // async, does not wait for put request to complete
      const tx = this.db.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);

      // Only bother to listen if logging
      if(this.verbose) {
        request.onsuccess = rdr.refreshIcons._onPutSuccess.bind(this, feed);
        request.onerror = rdr.refreshIcons._onPutError.bind(this, feed);
      }

    }
  }

  // The feed has been processed. If pendingCount reaches 0 then done
  this.pendingCount--;
  if(!this.pendingCount) {
    rdr.refreshIcons._onComplete.call(this);
  }
};

rdr.refreshIcons._onPutSuccess = function(feed, event) {
  console.debug('Finished updating feed', rdr.feed.getURL(feed));
};

// Treat database put errors as non-fatal
rdr.refreshIcons._onPutError = function(feed, event) {
  console.error(event.target.error);
};

rdr.refreshIcons._onComplete = function() {
  if(this.db) {
    if(this.verbose) {
      console.debug('Requesting database connection to close');
    }
    // The close will occur once the pending txs resolve
    this.db.close();
  }

  // This may occur in the log prior to pending requests resolving
  if(this.verbose) {
    console.log('Finished refreshing feed favicons');
  }
};
