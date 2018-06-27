import * as favicon from '/src/action/favicon/favicon.js';
import ModelAccess from '/src/model/model-access.js';

// TODO: deprecate, this no longer does that much and was using a weak form of
// temporal coherency instead of functional coherency. Instead, should create or
// use individual database controllers with separate install event listeners.
// See https://en.wikipedia.org/wiki/Cohesion_(computer_science)

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
    const ma = new ModelAccess();
    await ma.connect();
    ma.close();

    // Setup the favicon database explicitly
    conn = await favicon.open();
    conn.close();
  }
}
