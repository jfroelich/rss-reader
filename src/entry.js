// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to an entry database object.

function Entry() {}

Entry.prototype.getURL = function() {
  if(this.hasURL()) {
    return this.urls[this.urls.length - 1];
  }
  return null;
};

Entry.prototype.hasURL = function() {
  return this.urls && this.urls.length;
};

Entry.FLAGS = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};
