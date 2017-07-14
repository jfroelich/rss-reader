// See license.md

'use strict';

document.addEventListener('DOMContentLoaded', function(event) {

  // Bind a listener that reacts to the extension install event
  chrome.runtime.onInstalled.addListener(async function(event) {

    // Temp while debugging
    console.debug('Received install event');

    // Create or upgrade the database by connecting to it
    // Also initialize the app badge text
    let conn;
    try {
      conn = await db.connect();
      await updateBadgeText(conn);
    } catch(error) {
      console.warn(error);
    } finally {
      if(conn) {
        conn.close();
      }
    }
  });

  // Bind a listener that reacts to when the extension's badge is clicked
  chrome.browserAction.onClicked.addListener(async function(event) {
    try {
      await showSlideshowTab();
    } catch(error) {
      console.warn(error);
    }
  });

}, {'once': true});
