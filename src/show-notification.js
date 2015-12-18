// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: maybe we don't need the permission check at all?
// what happens if we just call notifications.create without
// permission? A basic exception? A no-op?
this.showNotification = function(message) {
  chrome.permissions.contains(
    {permissions: ['notifications']},
    showNotificationIfPermitted.bind(this, message));
};

function showNotificationIfPermitted(message, permitted) {

  if(!permitted) {
    return;
  }

  const notification = {
    type: 'basic',
    title: chrome.runtime.getManifest().name,
    iconUrl: '/media/rss_icon_trans.gif',
    message: message
  };

  chrome.notifications.create('lucubrate', notification, function(){});
}

} // END ANONYMOUS NAMESPACE
