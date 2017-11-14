import * as alarms from "/src/alarms.js";
import {showSlideshowTab} from "/src/extension.js";
import {closeDB} from "/src/idb.js";
import "/src/install.js";
import {readerCommand} from "/src/reader-command.js";
import {readerDbOpen} from "/src/reader-db.js";
import {readerBadgeUpdate} from "/src/reader-badge.js";

async function initializeBadgeText() {
  // initialize badge text
  let conn;
  try {
    conn = await readerDbOpen();
    await readerBadgeUpdate(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    closeDB(conn);
  }
}

async function onClicked(event) {
  showSlideshowTab();
}


// NOTE: in transition to modules I lost badge update, so calling it here. This sometimes
// causes a duplicate update.
initializeBadgeText();


chrome.browserAction.onClicked.addListener(onClicked);
