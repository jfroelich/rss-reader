import * as cron_control from '/src/control/cron-control.js';
import ReaderDAL from '/src/dal.js';
import * as favicon from '/src/control/favicon/favicon.js';

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

    cron_control.create_alarms();
  } else {
    cron_control.update_alarms(prev_version);
  }
}
