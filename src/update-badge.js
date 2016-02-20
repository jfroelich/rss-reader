// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/db.js

'use strict';

{

// Updates the unread count of the extension's badge
function updateBadge(connection) {
  if(connection) {
    db.countUnreadEntries(connection, setBadgeText);
  } else {
    db.open(updateOnConnect);
  }
}

this.updateBadge = updateBadge;

function updateOnConnect(event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    db.countUnreadEntries(connection, setBadgeText);
  } else {
    // Connection error
    console.debug(event);
    chrome.browserAction.setBadgeText({text: '?'});
  }
}

function setBadgeText(event) {
  const count = event.target.result || '?';
  chrome.browserAction.setBadgeText({
    text: count.toString()
  });
}

}
