'use strict';

// import base/errors.js
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
    conn = await readerDbOpen();
    status = await readerUpdateBadge(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    indexedDBClose(conn);
  }

  // Setup the favicon database
  try {
    await faviconDbSetup();
  } catch(error) {
    console.warn(error);
  }
});
