import * as extension from '/src/core/extension.js';
import * as tls from '/src/lib/tls.js';

// If notifications are enabled, generate and show a desktop notification.
// |note| has optional properties name, message, and url (string). Defaults are
// provided for missing properties.
export function show(note) {
  if (!tls.read_boolean('show_notifications')) {
    return;
  }

  const title = note.title || 'Untitled';
  const message = note.message || '';

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = note.url || default_icon;

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
