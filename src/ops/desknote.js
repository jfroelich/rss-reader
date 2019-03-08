import * as extension from '/src/extension.js';
import {resolve_extension_url_string} from '/src/resolve-extension-url.js';
import * as tls from '/src/typed-localstorage.js';

// TODO: notifications work on mobile too. This module should be renamed so it
// is less misleading.

// Show a desktop notification with optional title, message, and icon. |note|
// properties include title (string), message (string), and url (string).
//
// This wraps the generic notification feature with app-specific behavior
// including:
// * Canceling the notification if notifications are disabled in app settings.
// Callers do not need to be concerned with whether notifications are enabled.
// * Providing default values for title, message, and icon. Callers only need
// to supply the values they want, and this substitutes in the rest.
// * More gracefully handling an error situation when clicking on a notification
// while the browser window is closed.
// * Linking the notification click handler to the app's show view function.
export function show(note = {}) {
  if (!tls.read_boolean('show_notifications')) {
    return;
  }

  const default_icon =
      resolve_extension_url_string('/images/rss_icon_trans.gif');

  const title = note.title || 'Untitled';
  const details = {};
  details.body = note.message || '';
  details.icon = note.url || default_icon;

  // Instantiating the object also shows it
  const notification = new Notification(title, details);
  notification.addEventListener('click', event => {
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }
    extension.open_view().catch(console.warn);
  });
}
