
import {FaviconCache} from "/src/favicon-cache.js";
import {closeDB} from "/src/rbl.js";
import {readerBadgeUpdate} from "/src/reader-badge.js";
import {readerDbOpen} from "/src/reader-db.js";

async function onInstalled(event) {
  console.debug('onInstalled', event);

  // Init the badge text. As a side effect this will create the
  // reader-db database
  let conn;
  try {
    conn = await readerDbOpen();
    await readerBadgeUpdate(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    closeDB(conn);
  }

  const fic = new FaviconCache();

  // Setup the favicon database
  try {
    await fic.setup();
  } catch(error) {
    console.warn(error);
  }
}

console.debug('binding onInstalled listener');
chrome.runtime.onInstalled.addListener(onInstalled);
