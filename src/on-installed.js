// See license.md

'use strict';

// TODO: is there a way to not do this on every page load?
chrome.runtime.onInstalled.addListener(function(event) {
  console.log('Installing extension ...');

  // This is also the first database call, which triggers database setup
  const conn = null;
  update_badge(conn, SilentConsole);
});
