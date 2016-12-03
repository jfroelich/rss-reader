// See license.md

'use strict';

class DesktopNotification {
  // Shows a simple desktop notification with the given title and message.
  // Message and title are interpreted as plain text.
  // To show in notification center, toggle flag
  // chrome://flags/#enable-native-notifications
  static show(title, message, icon_url) {
    if(!Notification) {
      console.warn('Notification API not supported');
      return;
    }

    if(!('SHOW_NOTIFICATIONS' in localStorage)) {
      console.warn('Notifications disabled in settings', title);
      return;
    }

    if(Notification.permission !== 'granted') {
      console.warn('Notification permission not granted', title);
    }

    const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
    const details = {};
    details.body = message || '';
    details.icon = icon_url || default_icon;

    // Instantiation is now a verb I guess
    const notification = new Notification(title || 'Untitled', details);

    // Attach a click listener that opens the extension
    // Note: on Mac Chrome 55, double click works
    notification.addEventListener('click', function(event) {

      // If there is no browser window open, then Badge.showExtension fails with
      // an unhandable error. This fixes that error.
      try {
        const winObject = window.open();
        winObject.close();

        // TODO: Not sure if this line is needed, it is causing Chrome to
        // 'flash'
        //window.focus();

      } catch(error) {
        console.warn(error);
      }

      Badge.showExtension().catch(console.warn);
    });
  }
}
