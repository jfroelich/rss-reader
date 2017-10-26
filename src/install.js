'use strict';

// import base/status.js
// import extension.js
// import favicon.js

// This file should only be loaded in the background page of the extension

chrome.runtime.onInstalled.addListener(async function(event) {
  console.log('onInstalled event');

  // TODO: rather than setup db as a side effect, do it explicitly. Create a
  // function like reader_db_install in reader-db.js, and then call it here.

  // Init the badge text. As a side effect this will create the
  // reader-db database
  let status = await extension_update_badge_text();
  if(status !== STATUS_OK) {
    console.warn('failed to set badge text during installation');
  }

  // Setup the favicon database
  try {
    await favicon_db_setup();
  } catch(error) {
    console.warn(error);
  }
});
