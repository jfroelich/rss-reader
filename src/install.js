// Functionality related to extension installation

import {addInstallListener} from "/src/extension.js";
import FaviconCache from "/src/favicon-cache.js";
import {readerBadgeUpdate} from "/src/reader-badge.js";
import {
  close as readerDbClose,
  open as readerDbOpen
} from "/src/rdb.js";

async function onInstalled(event) {
  console.debug('onInstalled', event);

  // Init the badge text. As a side effect this will create the reader-db database
  let conn;
  try {
    conn = await readerDbOpen();

    // The background module now does this during initialization, this was leading to duplicate
    // badge updates. However, I am not certain it was correct to change that, so leaving this
    // comment here temporarily.
    // await readerBadgeUpdate(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    readerDbClose(conn);
  }

  const fic = new FaviconCache();

  // Setup the favicon database
  try {
    await fic.setup();
  } catch(error) {
    console.warn(error);
  }
}

addInstallListener(onInstalled);
