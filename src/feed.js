// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to a feed database object. Because indexedDB cannot store such
// objects, this is generally only intended to provide prototype members that
// can correctly operate on objects loaded from the database

function Feed() {}

// Gets the terminal url, which is the last url out of the feed's associated set
Feed.prototype.getURL = function() {
  return this.urls[this.urls.length - 1];
};
