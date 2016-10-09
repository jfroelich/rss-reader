// See license.md

'use strict';

var rdr = rdr || {};
rdr.notifications = {};

rdr.notifications.defaultIcon = chrome.extension.getURL(
  '/images/rss_icon_trans.gif');

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// Fails silently if not permitted
rdr.notifications.show = function(title, message, iconURLString) {

  // This could be optimized but there is no need
  if(!Notification) {
    console.debug('Notifications are not supported');
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.debug('Suppressed notification:', title || 'Untitled');
    return;
  }

  const details = {};
  details.body = message || '';
  details.icon = iconURLString || rdr.notifications.defaultIcon;

  // Instantiating a notification implicitly shows it
  new Notification(title || 'Untitled', details);
};
