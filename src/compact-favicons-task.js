// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Looks for and deletes expired icons from the cache
function CompactFaviconsTask() {
  this.cache = new FaviconCache();
  this.maxAge = this.cache.defaultMaxAge;
  this.log = new LoggingService();
}

CompactFaviconsTask.prototype.start = function() {
  this.log.log('Compacting favicon cache, max age:', ctx.maxAge);
  this.cache.connect(this._connectOnSuccess.bind(this),
    this._connectOnError.bind(this));
};

CompactFaviconsTask.prototype._connectOnSuccess = function(event) {
  this.log.debug('Connected to database');
  this.db = event.target.result;
  this.cache.openCursor(this.db,
    this._openCursorOnSuccess.bind(this),
    this._openCursorOnError.bind(this));
};

CompactFaviconsTask.prototype._connectOnError = function(event) {
  this.log.error(event.target.error);
  this._onComplete();
};

CompactFaviconsTask.prototype._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return this._onComplete();
  }

  const entry = cursor.value;
  this.log.debug(entry.pageURLString, new Date() - entry.dateUpdated);

  if(this.cache.isExpired(entry, this.maxAge)) {
    this.log.log('Deleting', entry.pageURLString);
    cursor.delete();
  }

  cursor.continue();
};

CompactFaviconsTask.prototype._openCursorOnError = function(event) {
  this.log.error(event.target.error);
  this._onComplete();
};

CompactFaviconsTask.prototype._onComplete = function() {
  if(this.db) {
    this.log.debug('Requesting database be closed');
    this.db.close();
  }

  this.log.log('Finished compacting favicon cache');
};
