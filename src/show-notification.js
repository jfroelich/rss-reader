import * as config from '/src/config.js';
import openView from '/src/open-view.js';

const defaultIcon = chrome.extension.getURL('/images/rss_icon_trans.gif');

export default function showNotification(message = '', icon = defaultIcon) {
  const enabled = config.readBoolean('notifications_enabled');
  if (!enabled) {
    return;
  }

  const title = 'RSS Reader';

  // Instantiating a notification shows it
  const notification = new Notification(title, { body: message, icon });
  notification.addEventListener('click', (event) => {
    // Work around a strange issue in older Chrome
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }

    const reuse_newtab = config.readBoolean('reuse_newtab');
    openView(reuse_newtab).catch(console.warn);
  });
}
