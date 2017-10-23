'use strict';


// import extension.js
// import favicon.js

chrome.runtime.onInstalled.addListener(async function(event) {
  console.log('chrome.runtime.onInstalled.addListener');

  // Init the badge text. As a side effect this will create the
  // reader-db database
  // Non-awaited.
  extension_update_badge_text();

  try {
    await favicon_setup_db();
  } catch(error) {
    console.warn(error);
  }
});
