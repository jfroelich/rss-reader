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

utils.fadeElement = function(element, duration, delay, callback) {
  function fade_end(callback, element, event) {
    event.target.removeEventListener('webkitTransitionEnd', fade_end);
    callback(element);
  }

  const style = element.style;

  if(style.display === 'none') {
    style.display = '';
    style.opacity = '0';
  }

  if(!style.opacity) {
    style.opacity = style.display === 'none' ? '0' : '1';
  }

  // TODO: why bind here? I moved the function into this function so I
  // no longer need to do this

  if(callback) {
    const fadeEndCallback = fade_end.bind(element, callback, element);
    element.addEventListener('webkitTransitionEnd', fadeEndCallback);
  }

  // property duration function delay
  style.transition = 'opacity ' + duration + 's ease ' + delay + 's';
  style.opacity = style.opacity === '1' ? '0' : '1';
};
