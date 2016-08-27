// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Shows a simple desktop notification with the given title and message, if
// various constraints are met. Message and title are treated as plain text.
// To show in notification center, toggle flag
// chrome://flags/#enable-native-notifications
function notify(title, message) {
  if(!Notification) {
    console.warn(
      'Canceled notification "%s" because Notification API not available',
      title);
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug(
      'Canceled notification "%s" because disabled in app settings', title);
    return;
  }

  // Fail silently if not permitted
  const defined_title = title || 'Untitled';
  const defined_msg = message || '';
  const icon_url = chrome.extension.getURL('/images/rss_icon_trans.gif');
  // Simply instantiating a notification shows it
  new Notification(defined_title, {'body': defined_msg, 'icon': icon_url});
}
