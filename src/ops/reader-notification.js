import * as config from '/src/config/config.js';
import * as extension from '/src/extension.js';

const default_icon_url = resolve_extension_path('/images/rss_icon_trans.gif');

export function ReaderNotification() {
  this.title = 'Untitled';
  this.message = undefined;
  this.icon_url = default_icon_url;
}

ReaderNotification.prototype.show = function() {
  if (!config.read_boolean('show_notifications')) {
    return;
  }

  const title = this.title || 'Untitled';
  const details = {};
  details.body = this.message || '';
  details.icon = this.icon_url || default_icon_url;

  // Instantiating a Notification shows it
  const notification = new Notification(title, details);
  notification.addEventListener('click', this.handleClick.bind(this));
};

ReaderNotification.prototype.handleClick = function(event) {
  // Work around a strange issue in older Chrome
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.error(error);
    return;
  }

  extension.open_view().catch(console.warn);
};

function resolve_extension_path(path) {
  return chrome.extension.getURL(path);
}
