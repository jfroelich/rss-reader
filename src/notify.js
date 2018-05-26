import {open_view} from '/src/open-view.js';

const default_icon_url_string =
    chrome.extension.getURL('/images/rss_icon_trans.gif');

export function notify(
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

  open_view().catch(console.warn);
}

/*
# notify
Notification service. Provides the ability to show a desktop notification. The
function dynamically checks if notifications are supported. There is also an app
setting to enable or disable notifications.

# TODOS
* Test if still a need to open window before handling notification click. The
notification click handler needs to check if the Chrome window is currently open
before trying to show a tab, otherwise Chrome crashes. This was present in
Chrome 55 on Mac. I want to test if this behavior is no longer needed.

*/
