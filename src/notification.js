// See license.md

'use strict';

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// To show in notification center, toggle flag
// chrome://flags/#enable-native-notifications
class DesktopNotification {

  static show(title, message, iconURLString) {
    if(typeof Notification === 'undefined') {
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

    const defaultIconURLString = chrome.extension.getURL(
      '/images/rss_icon_trans.gif');
    const details = {};
    details.body = message || '';
    details.icon = iconURLString || defaultIconURLString;

    // Instantiation also shows
    const notification = new Notification(title, details);

    // Attach a click listener that opens the extension
    // Note: on Mac Chrome 55, double click works
    notification.addEventListener('click', this.onClick);
  }

  static onClick(event) {
    // Ensure the browser is open to avoid crash
    try {
      const winObject = window.open();
      winObject.close();
    } catch(error) {
      console.warn(error);
    }

    ExtensionUtils.show().catch(console.warn);
  }
}
