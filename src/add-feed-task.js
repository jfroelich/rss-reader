// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Adds a feed to storage. The feed is prepped before storing. Calls back with
// the added feed. The added feed will have its id set.
function AddFeedTask() {
  this.log = new LoggingService();
  this.Feed = Feed;
  this.filterEmptyProps = ReaderUtils.filterEmptyProps;
}

AddFeedTask.prototype.start = function(db, feed, callback) {
  this.log.log('adding', this.Feed.getURL(feed));

  if('id' in feed) {
    throw new Error('should never have id property');
  }

  const ctx = {'feed': feed, 'callback': callback};
  ctx.feed = this.Feed.sanitize(ctx.feed);
  ctx.feed.dateCreated = new Date();
  ctx.feed = this.filterEmptyProps(ctx.feed);
  const transaction = db.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(ctx.feed);
  if(callback) {
    request.onsuccess = this._onSuccess.bind(this, ctx);
    request.onerror = this._onError.bind(this, ctx);
  }
};

AddFeedTask.prototype._onSuccess = function(ctx, event) {
  this.log.debug('added', this.Feed.getURL(ctx.feed));
  // Grab the auto-incremented id
  ctx.feed.id = event.target.result;
  this.log.debug('new id is', ctx.feed.id);
  ctx.callback({'type': 'success', 'feed': ctx.feed});
};

AddFeedTask.prototype._addOnError = function(ctx, event) {
  this.log.error(event.target.error);
  ctx.callback({'type': 'error'});
};
