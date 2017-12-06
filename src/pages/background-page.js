import FaviconCache from "/src/favicon/cache.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import {
  addBadgeClickListener,
  addInstallListener,
  showSlideshowTab
} from "/src/platform/platform.js";
import "/src/reader/alarms.js";
import "/src/reader/cli.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import openReaderDb from "/src/reader-db/open.js";
import setupReaderDb from "/src/reader-db/setup.js";

// This module should be loaded exclusively in the background page. Does various startup work.

// Top level async is not allowed in modules, at least not right now. This helper function exists
// to allow for the await, and to allow for finally to work given that some functions throw
// assertion errors outside of returned promises.
async function initBadgeText() {
  let conn;
  try {
    conn = await openReaderDb();
    await updateBadgeText(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    IndexedDbUtils.close(conn);
  }
}

async function onInstalled(event) {
  console.debug('onInstalled', event);

  // TODO: these two tasks are independent, why make the second wait on the first to resolve?

  try {
    await setupReaderDb();
  } catch(error) {
    console.warn(error);
  }

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

console.debug('Initializing background page');
addInstallListener(onInstalled);
addBadgeClickListener(onClicked);
initBadgeText();
