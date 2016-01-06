// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Opens a connection to the single local indexedDB database and
// passes the resulting event to the callback
// NOTE: cannot use openDatabase, that is a keyword reserved due to the old
// websql functionality
// TODO: this function is not really named correctly. This does not just open
// any instance of indexedDB, it only opens our particular usage. A more
// appropriate name would reflect that. Something like openReaderStorage
function openIndexedDB(callback) {
  'use strict';

  // App global settings, so this is a particularized function, maybe
  // that is not quite right but it works for now

  // TODO: consider using 'lucubrate' as the database name?
  const NAME = 'reader';
  const VERSION = 17;

  const request = indexedDB.open(NAME, VERSION);
  request.onupgradeneeded = upgradeIndexedDB;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
}
