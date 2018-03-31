import {rdr_open_view} from '/src/operations/rdr-open-view.js';

export function show(title, message, icon_url) {
  if (!('SHOW_NOTIFICATIONS' in localStorage)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const default_icon_url =
      chrome.extension.getURL('/images/rss_icon_trans.gif');

  const details = {};
  details.body = message || '';
  details.icon = icon_url || default_icon_url;

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
