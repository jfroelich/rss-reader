// Background page for extension. This should be loaded exclusively in the background page.

import "/src/alarms.js";
import "/src/cli.js";
import {addBadgeClickListener, showSlideshowTab} from "/src/extension.js";
import "/src/install.js";
import * as rdb from "/src/rdb.js";
import updateBadgeText from "/src/update-badge-text.js";

// Initialize the extension
async function init() {
  console.debug('initializing background page');

  addBadgeClickListener(onClicked);

  // Initialize badge text
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

async function onClicked(event) {
  showSlideshowTab();
}

// Run everytime the background page is loaded
init();
