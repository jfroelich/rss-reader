// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function queryIdleState(interval, callback) {
  'use strict';

  chrome.permissions.contains({permissions: ['idle']}, onCheck);

  function onCheck(permitted) {
  	if(!permitted) {
  	  callback();
  	  return;
  	}

  	chrome.idle.queryState(interval, callback);
  }
}

function updateBadge() {
  'use strict';
  openDatabaseConnection(onConnect);

  function onConnect(error, connection) {

    if(error) {
      console.debug(error);
      return;
    }

    const transaction = connection.transaction('entry');
    const entries = transaction.objectStore('entry');
    const unread = entries.index('unread');
    const request = unread.count();
    request.onsuccess = setText;
  }

  function setText(event) {
    const count = event.target.result || 0;
    const badgeText = {text: count.toString()};
    chrome.browserAction.setBadgeText(badgeText);
  }
}



function isOffline() {
  'use strict';
  return navigator && navigator.hasOwnProperty('onLine') && 
  	!navigator.onLine;
}

function showNotification(message) {
  'use strict';

  // TODO: maybe we don't need the permission check at all?
  // what happens if we just call notifications.create without
  // permission? A basic exception? A no-op?

  chrome.permissions.contains({permissions: ['notifications']}, 
    hasPermission);

  function hasPermission(permitted) {
    if(!permitted) return;

    const notification = {
      type: 'basic',
      title: chrome.runtime.getManifest().name,
      iconUrl: '/media/rss_icon_trans.gif',
      message: message
    };

    const appTitle = 'lucubrate';
    const callback = function(){};

    chrome.notifications.create(appTitle, notification, callback);
  }
}
