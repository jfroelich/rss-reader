// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Desktop notifications library
 */
lucu.notifications = {};

lucu.notifications.show = function(message) {
  var permissionQuery = {permissions: ['notifications']};
  var sip = lucu.notifications.showIfPermitted.bind(null, message);
  chrome.permissions.contains(permissionQuery, sip);
};

lucu.notifications.DEFAULT_TITLE = chrome.runtime.getManifest().name;
lucu.notifications.DEFAULT_ICON = '/media/rss_icon_trans.gif';

// helper for show
lucu.notifications.showIfPermitted = function(message, permitted) {
  if(!permitted) return;

  // For now we are just using a very simple default
  // notification. This could be improved in the future
  // for example by enabling clickable notifications
  // that do things like 

  var notification = {
    type: 'basic',
    title: lucu.notifications.DEFAULT_TITLE,
    iconUrl: lucu.notifications.DEFAULT_ICON,
    message: message
  };

  var notificationAppTitle = 'lucubrate';
  var callback = function(){};

  chrome.notifications.create(notificationAppTitle, notification, callback);
};