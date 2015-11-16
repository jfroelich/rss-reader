// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const BrowserActionUtils = {};

{ // BEGIN LEXICAL SCOPE

function update(connection) {
  // console.debug('Updating badge');
  if(connection) {
    EntryStore.countUnread(connection, setText);
  } else {
    Database.open(function(event) {
      if(event.type === 'success') {
        EntryStore.countUnread(event.target.result, 
          setText);
      } else {
        console.debug(event);
        chrome.browserAction.setBadgeText({text: '?'});
      }
    });
  }
}

// helper for update
function setText(event) {
  const count = event.target.result;
  chrome.browserAction.setBadgeText({
    text: count.toString()
  });
}

// Export
BrowserActionUtils.update = update;

} // END LEXICAL SCOPE
