// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function UpdateFeedTask() {
  this.log = new LoggingService();
  this.sanitizeFeed = rdr.feed.sanitize;
  this.filterEmptyProps = rdr.utils.filterEmptyProps;
  this.getFeedURL = rdr.feed.getURL;
}

UpdateFeedTask.prototype.start = function(db, feed, callback) {
  if(!feed.id) {
    throw new Error('Attempted to update a feed without a valid id');
  }

  if(!this.getFeedURL(feed)) {
    throw new Error('Attempted to update a feed without a url');
  }

  this.log.log('updating feed', this.getFeedURL(feed));

  const ctx = {'feed': feed, 'callback': callback};
  ctx.feed = this.sanitizeFeed(ctx.feed);
  ctx.feed.dateUpdated = new Date();
  ctx.feed = this.filterEmptyProps(ctx.feed);
  const tx = db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(ctx.feed);
  if(callback) {
    request.onsuccess = this._putOnSuccess.bind(this, ctx);
    request.onerror = this._putOnError.bind(this, ctx);
  }
}

UpdateFeedTask.prototype._putOnSuccess = function(ctx, event) {
  ctx.callback({'type': 'success', 'feed': ctx.feed});
};

UpdateFeedTask.prototype._putOnError = function(ctx, event) {
  this.log.error(event.target.error);
  ctx.callback({'type': 'error', 'feed': ctx.feed});
};
