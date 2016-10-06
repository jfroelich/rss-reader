// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function AddEntryTask() {
  this.log = new LoggingService();
  this.Entry = Entry;
  this.filterEmptyProps = ReaderUtils.filterEmptyProps;
}

AddEntryTask.prototype.start = function(db, entry, callback) {
  const entryURL = this.Entry.getURL(entry);
  this.log.log('adding entry', entryURL);
  const sanitized = this.Entry.sanitize(entry);
  const storable = this.filterEmptyProps(sanitized);
  storable.readState = this.Entry.flags.UNREAD;
  storable.archiveState = this.Entry.flags.UNARCHIVED;
  storable.dateCreated = new Date();
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storable);
  request.onsuccess = callback;
  // Wrap the callback primarily just to log the error
  request.onerror = this._onError.bind(this, storable, callback);
};

AddEntryTask.prototype._onError = function(entry, callback, event) {
  this.log.error(this.Entry.getURL(entry), event.target.error);
  callback(event);
};
