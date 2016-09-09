// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const iconURLString = chrome.extension.getURL('/images/rss_icon_trans.gif');

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// Fails silently if not permitted
function showDesktopNotification(title, message) {
  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug( 'Suppressed notification:', title || 'Untitled');
    return;
  }

  const definedTitle = title || 'Untitled';
  const definedMessage = message || '';
  const details = {'body': definedMessage, 'icon': iconURLString};

  // Creating a notification shows it
  new Notification(definedTitle, details);
}

function noop() {}

if(Notification) {
  this.showDesktopNotification = showDesktopNotification;
} else {
  console.warn('Notifications are not supported');
  this.showDesktopNotification = noop;
}

} // End file block scope
