import show_slideshow_tab from '/src/show-slideshow-tab.js';

export default function notification_show(title, message, icon_url) {
  if (typeof Notification === 'undefined') {
    return;
  }

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
  notification.addEventListener('click', notification_onclick);
}

function notification_onclick(event) {
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.warn(error);
    return;
  }

  show_slideshow_tab().catch(console.warn);
}
