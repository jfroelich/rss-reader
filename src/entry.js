// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to an entry database object.

function Entry() {}

Entry.prototype.getURL = function() {
  if(this.urls && this.urls.length) {
    return this.urls[this.urls.length - 1];
  }
  return null;
};

Entry.prototype.hasURL = function() {
  return this.urls && this.urls.length;
};

// Returns the entry in archived form
Entry.prototype.archive = function() {
  const outputEntry = {};
  outputEntry.id = this.id;
  outputEntry.feed = this.feed;
  outputEntry.urls = [...this.urls];
  outputEntry.dateArchived = new Date();
  outputEntry.archiveState = Entry.FLAGS.ARCHIVED;
  // TODO: do i need to clone date to ensure purity?
  if(this.dateRead) {
    outputEntry.dateRead = this.dateRead;
  }
  return outputEntry;
};

Entry.FLAGS = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};
