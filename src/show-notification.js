// See license.md

'use strict';

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// Fails silently if not permitted.
// To show in notification center, toggle flag
// chrome://flags/#enable-native-notifications
function show_notification(title, message, icon_url) {
  if(!Notification) {
    console.debug('Notifications are not supported');
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug('Suppressed notification:', title || 'Untitled');
    return;
  }

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  const details = {};
  details.body = message || '';
  details.icon = icon_url || default_icon;

  // Instantiation is now a verb I guess
  new Notification(title || 'Untitled', details);
}
