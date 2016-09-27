// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.refreshIcons = {};

// TODO: once this is implemented, decouple the icon lookup for feeds in
// polling

/*
How this should work:

- connect to feeds db
- get all feeds
- for each feed, lookup its favicon
- if its icon changed, or was never set, then update the feed


*/

// Scan for icons in the favicon cache that should be refreshed and then update
// the feeds database accordingly
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

      // async
      rdr.refreshIcons._updateFeed.call(this, feed);
    }
  }

  this.pendingCount--;
  if(!this.pendingCount) {
    rdr.refreshIcons._onComplete.call(this);
  }
};

rdr.refreshIcons._updateFeed = function(feed) {

  if(this.verbose) {
    console.debug('Putting feed', rdr.feed.getURL(feed));
  }

  const tx = this.db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(feed);
  request.onerror = rdr.refreshIcons._onPutError.bind(this, feed);
};

rdr.refreshIcons._onPutError = function(feed, event) {
  if(this.verbose) {
    console.error('Error putting feed', rdr.feed.getURL(feed));
  }

  console.error(event.target.error);
};

rdr.refreshIcons._onComplete = function() {
  if(this.db) {
    if(this.verbose) {
      console.debug('Requesting database connection to close');
    }
    this.db.close();
  }

  if(this.verbose) {
    console.log('Finished refreshing feed favicons');
  }
};
