// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function updateBadgeUnreadCount(connection, callback) {

  const feedCache = new FeedCache();

  if(connection) {
    feedCache.countUnreadEntries(connection, onCountUnreadEntries);
  } else {
    feedCache.open(onOpenDatabase);
  }

  function onOpenDatabase(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      feedCache.countUnreadEntries(connection, onCountUnreadEntries);
    } else {
      console.debug(event);
      chrome.browserAction.setBadgeText({'text': '?'});

      if(callback) {
        callback();
      }
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

    if(callback) {
      callback();
    }
  }
}
