import * as config from '/src/config.js';
import * as extension_tab from '/src/tab.js';

export function show(title, message, icon_url_string) {
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

  await extension_tab.open_view();
}
