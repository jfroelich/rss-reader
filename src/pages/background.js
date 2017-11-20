// Background page for extension. This should be loaded exclusively in the background page.

import "/src/alarms.js";
import "/src/cli.js";
import {addBadgeClickListener, addInstallListener, showSlideshowTab} from "/src/extension.js";
import FaviconCache from "/src/favicon/cache.js";
import * as rdb from "/src/storage/rdb.js";
import updateBadgeText from "/src/reader/update-badge-text.js";

// Top level async is not allowed in modules, at least not right now. This helper function exists
// to allow for the await, and to allow for finally to work given that some functions throw
// assertion errors outside of returned promises.
async function initBadgeText() {
  let conn;
  try {
    conn = await rdb.open();
    await updateBadgeText(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    rdb.close(conn);
  }
}

async function onInstalled(event) {
  console.debug('onInstalled', event);

  // Setup the reader-db database
  try {
    await rdb.setup();
  } catch(error) {
    console.warn(error);
  }

  // Setup the favicon database
  const fic = new FaviconCache();
  try {
    await fic.setup();
  } catch(error) {
    console.warn(error);
  }
}

async function onClicked(event) {
  showSlideshowTab();
}


console.debug('initializing background page');

addInstallListener(onInstalled);
addBadgeClickListener(onClicked);
initBadgeText();
