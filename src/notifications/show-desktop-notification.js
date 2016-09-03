// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const icon_url = chrome.extension.getURL('/images/rss_icon_trans.gif');

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// Fails silently if not permitted
function show_desktop_notification(title, message) {
  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug( 'Suppressed notification:', title || 'Untitled');
    return;
  }

  const defined_title = title || 'Untitled';
  const defined_msg = message || '';
  const details = {'body': defined_msg, 'icon': icon_url};

  // Creating a notification shows it
  new Notification(defined_title, details);
}

function noop() {}

if(Notification) {
  this.show_desktop_notification = show_desktop_notification;
} else {
  console.warn('Notifications are not supported');
  this.show_desktop_notification = noop;
}

} // End file block scope
