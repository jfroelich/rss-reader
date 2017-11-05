'use strict';

// import base/errors.js
// import extension.js
// import favicon.js
// import reader-badge.js
// import reader-db.js

chrome.runtime.onInstalled.addListener(async function(event) {
  console.log('onInstalled', event);

  // Init the badge text. As a side effect this will create the
  // reader-db database
  let conn;
  try {
    conn = await readerDbOpen();
    await readerBadgeUpdate(conn);
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
