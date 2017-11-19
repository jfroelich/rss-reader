// Functionality related to extension installation

import {addInstallListener} from "/src/extension.js";
import FaviconCache from "/src/favicon/cache.js";
import updateBadgeText from "/src/update-badge-text.js";
import * as rdb from "/src/rdb.js";

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

addInstallListener(onInstalled);
