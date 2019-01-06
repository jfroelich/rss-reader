import * as config from '/src/config.js';
import * as utils from '/src/utils.js';

// @param note {Object} has properties name, message, and url (string), each
// property is optional, but note itself is not optional
export function show(note) {
  const title = note.title || 'Untitled';
  const message = note.message || '';
  const icon_url_string = note.url;

  if (!config.read_boolean('show_notifications')) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = icon_url_string || default_icon;

  const notification = new Notification(title, details);
  notification.addEventListener('click', onclick);
}

async function onclick(event) {
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.error(error);
    return;
  }

  await utils.open_view(config);
}
