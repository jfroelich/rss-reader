// Browser action
// This should only be loaded in the extension background

// Dependencies:
// debug.js
// extension.js

'use strict';

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await extension_show_slideshow_tab();
  } catch(error) {
    DEBUG(error);
  }
});
