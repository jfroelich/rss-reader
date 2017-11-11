'use strict';

// import extension.js
// import favicon-cache.js
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
    closeDB(conn);
  }

  const fic = new FaviconCache();

  // Setup the favicon database
  try {
    await fic.setup();
  } catch(error) {
    console.warn(error);
  }
});
