import FaviconCache from "/src/favicon/cache.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {
  addBadgeClickListener,
  addInstallListener,
  showSlideshowTab
} from "/src/platform/platform.js";
import "/src/reader/alarms.js";
import "/src/reader/cli.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import setupReaderDb from "/src/reader-db/setup.js";

// This module should be loaded exclusively in the background page. Does various startup work.

// Top level async is not allowed in modules, at least not right now. This helper function exists
// to allow for the await, and to allow for finally to work given that some functions throw
// assertion errors outside of returned promises.
async function initBadgeText() {
  const fs = new FeedStore();
  try {
    await fs.open();
    await updateBadgeText(fs.conn);
  } catch(error) {
    console.warn(error);
  } finally {
    fs.close();
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
