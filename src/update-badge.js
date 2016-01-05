// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

// Updates the unread count of the extension's badge
// TODO: deprecate the entryStore parameter, hardlink the dependency
function updateBadge(entryStore, connection) {
  if(connection) {
    entryStore.countUnread(connection, setBadgeText);
  } else {
    openIndexedDB(updateOnConnect.bind(null, entryStore));
  }
}

this.updateBadge = updateBadge;

function updateOnConnect(entryStore, event) {
  if(event.type === 'success') {
    entryStore.countUnread(event.target.result, setBadgeText);
  } else {
    console.debug(event);
    chrome.browserAction.setBadgeText({text: '?'});
  }
}

function setBadgeText(event) {
  const count = event.target.result;
  chrome.browserAction.setBadgeText({
    text: count.toString()
  });
}

}
