import * as color from '/src/argb8888.js';
import * as badge from '/src/control/badge-control.js';
import * as cron_control from '/src/control/cron-control.js';
import {ReaderDAL} from '/src/dal.js';
import * as favicon from '/src/favicon/favicon.js';

export async function oninstalled(event) {
  // See https://developer.chrome.com/extensions/runtime#event-onInstalled
  // String. Indicates the previous version of the extension, which has just
  // been updated. This is present only if 'reason' is 'update'.
  const prev_version = event.previousVersion;
  // String. The reason that this event is being dispatched.
  // "install", "update", "chrome_update", or "shared_module_update"
  const reason = event.reason;

  if (reason === 'install') {
    // Explicitly create the reader database
    const dal = new ReaderDAL();
    await dal.connect();
    dal.close();

    // Setup the favicon database explicitly
    conn = await favicon.open();
    conn.close();

    badge.refresh(location.pathname);

    cron_control.create_alarms();
  } else if (reason === 'update') {
    cron_control.update_alarms(prev_version);

    // Without this call the badge loses its text on extension reload
    badge.refresh(location.pathname);
  } else {
    console.warn('Unhandled oninstalled event', event);
  }
}
