// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const defaultIconURLString = chrome.extension.getURL(
  '/images/rss_icon_trans.gif');

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// Fails silently if not permitted
function showDesktopNotification(title, message, iconURLString) {
  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug('Suppressed notification:', title || 'Untitled');
    return;
  }

  const details = {};
  details.body = message || '';
  details.icon = iconURLString || defaultIconURLString;

  // Creating a notification shows it
  new Notification(title || 'Untitled', details);
}

function noop() {}

if(Notification) {
  this.showDesktopNotification = showDesktopNotification;
} else {
  console.warn('Notifications are not supported');
  this.showDesktopNotification = noop;
}

} // End file block scope
