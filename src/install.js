'use strict';

// import base/status.js
// import extension.js
// import favicon.js
// import reader-badge.js
// import reader-db.js

// This file should only be loaded in the background page of the extension

chrome.runtime.onInstalled.addListener(async function(event) {
  console.log('onInstalled', event);

  // Init the badge text. As a side effect this will create the
  // reader-db database

  let conn, status;
  try {
    conn = await reader_db_open();
    status = await reader_update_badge(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    indexeddb_close(conn);
  }

  // Setup the favicon database
  try {
    await favicon_db_setup();
  } catch(error) {
    console.warn(error);
  }
});
