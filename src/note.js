import * as config from '/src/config.js';
import * as utils from '/src/utils.js';

// |note| has optional properties name, message, and url (string)
export function show(note) {
  if (!config.read_boolean('show_notifications')) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const title = note.title || 'Untitled';
  const message = note.message || '';

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = note.url || default_icon;

  const note = new Notification(title, details);
  note.addEventListener('click', event => {
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }
    utils.open_view(config).catch(console.warn);
  });
}
