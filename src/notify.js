// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Shows a simple desktop notification with the given title and message, if
// various constraints are met.
// NOTE: alot of these checks are invariant and could be hoisted but for now
// I don't think there is a performance issue.
// NOTE: html is treated as plain text (e.g. <i> renders as <i>).
// NOTE: to show in notification center from chrome, toggle flag
// chrome://flags/#enable-native-notifications
function notify(title, message) {
  if(!Notification) {
    console.debug('Notifications API not available');
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug('Notifications disabled in app settings');
    return;
  }

  // Assume permitted, no need to check
  // If not permitted then the failure is silent, I think that is fine?

  const defined_title = title || 'Untitled';
  const defined_msg = message || '';
  const icon_url_string = chrome.extension.getURL('/images/rss_icon_trans.gif');

  // Simply instantiating a new Notification object shows it
  const notification = new Notification(defined_title, {
    'body': defined_msg,
    'icon': icon_url_string
  });
}
