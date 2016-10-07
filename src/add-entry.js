// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

function addEntry(db, entry, callback) {
  const $this = this || {};
  const $LoggingService = $this.LoggingService || LoggingService;
  const $Entry = $this.Entry || Entry;
  const $ReaderUtils = $this.ReaderUtils || ReaderUtils;

  // TODO: how to easily set log.enabled to true externally?

  const log = new $LoggingService();
  const entryURL = $Entry.getURL(entry);
  log.log('adding entry', entryURL);
  const sanitized = $Entry.sanitize(entry);
  const storable = $ReaderUtils.filterEmptyProps(sanitized);
  storable.readState = $Entry.flags.UNREAD;
  storable.archiveState = $Entry.flags.UNARCHIVED;
  storable.dateCreated = new Date();
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storable);
  request.onsuccess = callback;
  request.onerror = onError.bind(null, $Entry, log, storable, callback);
}

function onError($Entry, log, entry, callback, event) {
  log.error($Entry.getURL(entry), event.target.error);
  callback(event);
}

this.addEntry = addEntry;

}
