import * as ls from '/src/lib/ls.js';

const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');

export async function open_view() {
  const slideshow_url_string = chrome.extension.getURL('slideshow.html');
  const new_tab_url_string = 'chrome://newtab/';

  const slideshow_tabs = await find_tabs(slideshow_url_string);
  if (slideshow_tabs && slideshow_tabs.length) {
    chrome.tabs.update(slideshow_tabs[0].id, {active: true});
    return;
  }

  const new_tabs = await find_tabs(new_tab_url_string);
  if (new_tabs && new_tabs.length) {
    chrome.tabs.update(
        new_tabs[0].id, {active: true, url: slideshow_url_string});
    return;
  }

  chrome.tabs.create({url: slideshow_url_string});
}

// Show a desktop notification. Dynamically checks if notifications are
// supported. There is also an app setting to enable or disable notifications.
export function show_notification(
    title, message, icon_url_string = default_icon) {
  if (!ls.read_boolean('show_notifications')) {
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
  notification.addEventListener('click', notification_onclick);
}

function find_tabs(url_string) {
  return new Promise(resolve => chrome.tabs.query({url: url_string}, resolve));
}

async function notification_onclick(event) {
  // TODO: test if this is still needed to workaround Chrome 66 error when
  // window is closed
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.error(error);
    return;
  }

  await open_view();
}
