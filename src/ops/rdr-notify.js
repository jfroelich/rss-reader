import {rdr_open_view} from '/src/ops/rdr-open-view.js';

const default_icon_url_string =
    chrome.extension.getURL('/images/rss_icon_trans.gif');

export function rdr_notify(
    title, message, icon_url_string = default_icon_url_string) {
  if (!('SHOW_NOTIFICATIONS' in localStorage)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const details = {};
  details.body = message || '';
  details.icon = icon_url_string;

  // Instantiation implicitly shows the notification
  const notification = new Notification(title, details);
  notification.addEventListener('click', click_handler);
}

function click_handler(event) {
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.warn(error);
    return;
  }

  rdr_open_view().catch(console.warn);
}
