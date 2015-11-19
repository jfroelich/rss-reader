// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const BrowserActionUtils = {};

{ // BEGIN ANONYMOUS NAMESPACE

// Updates the unread count of the extension's badge
// @param connection optional, an indexedDB database connection
BrowserActionUtils.update = function(connection) {
  // console.debug('Updating badge');
  if(connection) {
    EntryStore.countUnread(connection, setText);
  } else {
    Database.open(updateOnConnect);
  }
};

// Private helper for update
function updateOnConnect(event) {
  if(event.type === 'success') {
    EntryStore.countUnread(event.target.result, setText);
  } else {
    // indexedDB connection error
    console.debug(event);
    chrome.browserAction.setBadgeText({text: '?'});
  }
}

// Sets the badge text. Private helper for update
function setText(event) {
  const count = event.target.result;
  chrome.browserAction.setBadgeText({
    text: count.toString()
  });
}

} // END ANONYMOUS NAMESPACE
