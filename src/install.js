'use strict';

// import base/debug.js
// import extension.js
// import favicon.js

chrome.runtime.onInstalled.addListener(async function(event) {
  DEBUG('onInstalled');

  // Init the badge text. As a side effect this will create the
  // reader-db database
  // Non-awaited.
  extension_update_badge_text();

  try {
    await favicon_setup_db();
  } catch(error) {
    DEBUG(error);
  }
});
