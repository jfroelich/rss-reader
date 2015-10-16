// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Desktop notifications library
 */
lucu.notifications = {};

lucu.notifications.show = function(message) {
  'use strict';

  const DEFAULT_TITLE = chrome.runtime.getManifest().name;
  const DEFAULT_ICON = '/media/rss_icon_trans.gif';
  chrome.permissions.contains({permissions: ['notifications']}, 
    hasPermission);

  function hasPermission(permitted) {
    if(!permitted) return;

    const notification = {
      type: 'basic',
      title: DEFAULT_TITLE,
      iconUrl: DEFAULT_ICON,
      message: message
    };

    const appTitle = 'lucubrate';
    const callback = function(){};

    chrome.notifications.create(appTitle, notification, callback);
  }
};
