// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: thinking more about dependency injection, would it be better
// to do something like pass EntryStore and database to updateBadge
// such that they can be mocked in testing? Something like that? Then
// maybe we want a utility that simplifies this, or want to wrap it
// up in a special object, or some type of function factory
// NOTE: i am not sure i like how i did the DI here, right now it is just
// an experiment to see how the surface API feels. Maybe it would be better
// to try the bind route

'use strict';

{

// Updates the unread count of the extension's badge
function updateBadge(entryStore, connection) {
  if(connection) {
    entryStore.countUnread(connection, setBadgeText);
  } else {
    openIndexedDB(updateOnConnect.bind(null, entryStore));
  }
}

this.updateBadge = updateBadge;

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
