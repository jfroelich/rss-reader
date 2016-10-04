// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: rename to refresh-feed-icons-task

function RefreshFeedIconsTask() {
  this.log = new LoggingService();
  this.openDBTask = new OpenFeedDbTask();
  this.lookupTask = new LookupFaviconTask();
  this.getAllFeedsTask = new GetAllFeedsTask();
  this.getFeedURL = rdr.feed.getURL;
}

// Refresh the favicon for stored feeds
RefreshFeedIconsTask.prototype.start = function(verbose) {
  this.log.log('Refreshing feed favicons...');
  const ctx = {'pendingCount': 0};
  this.openDBTask.open(this._openDBOnSuccess.bind(this, ctx),
    this._openDBOnError.bind(this, ctx));
};

RefreshFeedIconsTask.prototype._openDBOnSuccess = function(ctx, event) {
  ctx.db = event.target.result;
  this.getAllFeedsTask.start(ctx.db, this._onGetAllFeeds.bind(this, ctx));
};

RefreshFeedIconsTask.prototype._openDBOnError = function(event) {
  this.log.error(event.target.error);
  this._onComplete(ctx);
};

RefreshFeedIconsTask.prototype._onGetAllFeeds = function(ctx, feeds) {
  ctx.pendingCount = feeds.length;
  if(!ctx.pendingCount) {
    this.log.log('No feeds found');
    this._onComplete(ctx);
    return;
  }

  for(let feed of feeds) {
    this._lookup(ctx, feed);
  }
};

RefreshFeedIconsTask.prototype._lookup = function(ctx, feed) {
  this.log.debug('Checking', this.getFeedURL(feed));
  // Get the lookup url for the feed. Prefer the link because it is a website
  // associated with the feed. Otherwise fall back to using the domain of the
  // url to the feed's xml file. None of the parsing should throw.
  let lookupURL = null;
  if(feed.link) {
    lookupURL = new URL(feed.link);
  } else {
    const feedURL = new URL(this.getFeedURL(feed));
    lookupURL = new URL(feedURL.origin);
  }

  const doc = null;
  this.lookupTask.start(lookupURL, doc, this._onLookup.bind(this, ctx, feed));
};

RefreshFeedIconsTask.prototype._onLookup = function(ctx, feed, iconURL) {

  this.log.debug('lookup result', this.getFeedURL(feed), iconURL ?
    iconURL.href: 'no icon');

  if(iconURL) {
    if(!feed.faviconURLString || feed.faviconURLString !== iconURL.href) {

      this.log.debug('Setting feed %s favicon to %s', this.getFeedURL(feed),
        iconURL.href);
      feed.faviconURLString = iconURL.href;
      feed.dateUpdated = new Date();
      // async, does not wait for put request to complete
      const tx = ctx.db.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);

      // Only listen if logging
      if(this.log.enabled) {
        request.onsuccess = this._onPutSuccess.bind(this, ctx, feed);
        request.onerror = this._onPutError.bind(this, ctx, feed);
      }
    }
  }

  // The feed has been processed. If pendingCount reaches 0 then done
  ctx.pendingCount--;
  if(!ctx.pendingCount) {
    this._onComplete(ctx);
  }
};

RefreshFeedIconsTask.prototype._onPutSuccess = function(ctx, feed, event) {
  this.log.debug('Updated feed', this.getFeedURL(feed));
};

// Treat database put errors as non-fatal
RefreshFeedIconsTask.prototype._onPutError = function(ctx, feed, event) {
  this.log.error(event.target.error);
};

RefreshFeedIconsTask.prototype._onComplete = function(ctx) {
  if(ctx.db) {
    this.log.debug('Requesting database connection to close');
    ctx.db.close();
  }

  // This may occur in the log prior to pending requests resolving
  this.log.log('Finished refreshing feed favicons');
};
