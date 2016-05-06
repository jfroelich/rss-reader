// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Requires: /src/db.js
// Requires: /src/entry.js

const utils = {};

// Updates the unread count of the extension's badge. Connection is optional.
utils.updateBadgeText = function(connection) {

  function countUnread(connection) {
    const transaction = connection.transaction('entry');
    const store = transaction.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_FLAGS.UNREAD);
    request.onsuccess = setText;
  }

  function onConnect(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      countUnread(connection);
    } else {
      console.debug(event);
      const text = {'text': '?'};
      chrome.browserAction.setBadgeText(text);
    }
  }

  function setText(event) {
    const request = event.target;
    const count = request.result || 0;
    const text = {'text': '' + count};
    chrome.browserAction.setBadgeText(text);
  }

  if(connection) {
    countUnread(connection);
  } else {
    db_open(onConnect);
  }
};
