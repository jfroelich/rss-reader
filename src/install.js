'use strict';

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
    rbl.closeDB(conn);
  }

  // Setup the favicon database
  try {
    await faviconDbSetup();
  } catch(error) {
    console.warn(error);
  }
});
