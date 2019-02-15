import * as extension from '/src/core/extension.js';
import {assert} from '/src/lib/assert.js';

// Maybe generate and show a desktop notification provided that notifications
// are enabled in settings. |note| has optional properties name, message, and
// url (string). Defaults are provided for missing properties.
// TODO: utils is located in core, so this is located in core, so there is no
// longer a need to do config dependency injection, so the config parameter
// should be removed and instead config should be imported
export function show_notification(config, note) {
  if (!config.read_boolean('show_notifications')) {
    return;
  }

  const title = note.title || 'Untitled';
  const message = note.message || '';

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = note.url || default_icon;

  const notification = new Notification(title, details);
  notification.addEventListener('click', event => {
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }
    extension.open_view().catch(console.warn);
  });
}
