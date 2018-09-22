import * as extension_tab from '/src/extension-tab/extension-tab.js';
import * as local_storage from '/src/localstorage/localstorage.js';

export function show(title, message, icon_url_string) {
  if (!local_storage.read_boolean('show_notifications')) {
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
  // TODO: test if this opening of window is still needed to workaround Chrome
  // 66 error when window is closed
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.error(error);
    return;
  }

  await extension_tab.open_view();
}
