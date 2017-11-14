// Background page for extension
// This should be loaded exclusively in the background page

import "/src/alarms.js";
import {addBadgeClickListener, showSlideshowTab} from "/src/extension.js";
import "/src/install.js";
import "/src/reader-command.js";
import {
  close as readerDbClose,
  open as readerDbOpen
} from "/src/rdb.js";
import {readerBadgeUpdate} from "/src/reader-badge.js";

// Initialize the extension
async function init() {
  console.debug('initializing background page');

  addBadgeClickListener(onClicked);

  // Initialize badge text
  let conn;
  try {
    conn = await readerDbOpen();
    await readerBadgeUpdate(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    readerDbClose(conn);
  }
}

async function onClicked(event) {
  showSlideshowTab();
}

// Run everytime the background page is loaded
init();
