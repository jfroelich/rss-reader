import * as localStorageUtils from '/src/lib/local-storage-utils.js';
import openTab from '/src/lib/open-tab.js';

// TODO: decouple from local storage utils, accept reuseNewtab as a parameter

const defaultIcon = chrome.extension.getURL('/images/rss_icon_trans.gif');

export default function showNotification(message = '', icon = defaultIcon) {
  const enabled = localStorageUtils.readBoolean('notifications_enabled');
  if (!enabled) {
    return;
  }

  const title = 'RSS Reader';

  // Instantiating a notification shows it
  const notification = new Notification(title, { body: message, icon });
  notification.addEventListener('click', () => {
    // Work around a strange issue in older Chrome
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }

    const reuseNewtab = localStorageUtils.readBoolean('reuse_newtab');
    openTab('slideshow.html', reuseNewtab).catch(console.warn);
  });
}
