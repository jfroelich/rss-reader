// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

// TODO: thinking more about dependency injection, would it be better
// to do something like pass EntryStore and database to updateBadge
// such that they can be mocked in testing? Something like that? Then
// maybe we want a utility that simplifies this, or want to wrap it
// up in a special object, or some type of function factory

// Updates the unread count of the extension's badge
this.updateBadge = function(database, entryStore, connection) {
  if(connection) {
    entryStore.countUnread(connection, setBadgeText);
  } else {
    database.open(updateOnConnect.bind(null, entryStore));
  }
};

// Private helper for updateBadge
function updateOnConnect(entryStore, event) {
  if(event.type === 'success') {
    entryStore.countUnread(event.target.result, setBadgeText);
  } else {
    console.debug(event);
    chrome.browserAction.setBadgeText({text: '?'});
  }
}

// Sets the badge text. Private helper for updateBadge
function setBadgeText(event) {
  const count = event.target.result;
  chrome.browserAction.setBadgeText({
    text: count.toString()
  });
}

}
