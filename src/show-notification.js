import * as config from '/src/config.js';
import open_view from '/src/open-view.js';

const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');

export default function show_notification(message = '', icon = default_icon) {
  const enabled = config.read_boolean('notifications_enabled');
  if (!enabled) {
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

    const reuse_newtab = config.read_boolean('reuse_newtab');
    open_view(reuse_newtab).catch(console.warn);
  });
}
