// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Requires: /src/db.js
// Requires: /src/entry.js

// Updates the unread count of the extension's badge
function badge_update_count(connection) {
  if(connection) {
    badge_count_unread_entries(connection, badge_set_count_from_request);
  } else {
    db_open(badge_on_connect);
  }
}

function badge_on_connect(event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    badge_count_unread_entries(connection, badge_set_count_from_request);
  } else {
    console.debug(event);
    chrome.browserAction.setBadgeText({text: '?'});
  }
}

function badge_set_count_from_request(event) {
  const request = event.target;
  const count = request.result || 0;
  const text = {'text': '' + count};
  chrome.browserAction.setBadgeText(text);
}

function badge_count_unread_entries(connection, callback) {
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_FLAGS.UNREAD);
  request.onsuccess = callback;
}
