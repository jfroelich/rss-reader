import * as local_storage from '/src/base/localstorage.js';
import * as extension_tab from '/src/control/extension-tab.js';

// TODO: i am placing this in the control layer for now. however, i think this
// somehow belongs in the base layer, but in the app-specific part, so that it
// is located beneath the database/model layer, so that the model layer can also
// consider using notification functionality. or maybe it is located in the
// right place. need to think about it more.

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
