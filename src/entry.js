// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Entry utilities
// Requires: /src/db.js

var ENTRY_FLAGS = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

// Returns an entry object suitable for storage. This contains only those
// fields that should persist after archive.
function entry_to_archive(inputEntry) {
  'use strict';

  const outputEntry = {};
  outputEntry.id = inputEntry.id;
  outputEntry.feed = inputEntry.feed;
  outputEntry.link = inputEntry.link;
  outputEntry.archiveDate = Date.now();
  outputEntry.archiveState = ENTRY_FLAGS.ARCHIVED;
  return outputEntry;
}
