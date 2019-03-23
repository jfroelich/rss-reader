import * as config from '/src/config.js';
import open_view from '/src/extension/open-view.js';

const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');

export default function show_notification(message = '', icon = default_icon) {
  if (!config.read_boolean('show_notifications')) {
    return;
  }

  const title = 'RSS Reader';

  // Instantiating a notification shows it
  const notification = new Notification(title, {body: message, icon: icon});
  notification.addEventListener('click', event => {
    // Work around a strange issue in older Chrome
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }

    open_view().catch(console.warn);
  });
}
