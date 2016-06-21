// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Connection is optional.
function updateBadgeUnreadCount(connection) {
  if(connection) {
    db.countUnreadEntries(connection, onCountUnreadEntries);
  } else {
    db.open(onConnect);
  }

  function onConnect(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      db.countUnreadEntries(connection, onCountUnreadEntries);
    } else {
      console.debug(event);
      chrome.browserAction.setBadgeText({'text': '?'});
    }
  }

  function onCountUnreadEntries(event) {
    if(event.type === 'success') {
      const count = event.target.result;
      chrome.browserAction.setBadgeText({'text': '' + count});
    } else {
      console.debug(event);
      chrome.browserAction.setBadgeText({'text': '?'});
    }
  }
}
