

// DEVNOTE: if including in manifest.json does not work, change manifest to load
// background.html instead, and use module script type there

import * as alarms from "/src/alarms.js";
import * as bindBrowserAction from "/src/bind-browser-action.js";
import {readerCommand} from "/src/reader-command.js";
import * as installer from "/src/install.js";

import {closeDB} from "/src/rbl.js";
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

// NOTE: in transition to modules I lost badge update, so calling it here. This sometimes
// causes a duplicate update.
initializeBadgeText();
