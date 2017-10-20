'use strict';

// This file should only be loaded in the extension background

// import base/debug.js
// import base/extension.js

// TODO: this isn't a module that exposes functionality about browser actions,
// this is a binding call. rename the file to something clearer, like
// bind-browser-action.js

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await extension_show_slideshow_tab();
  } catch(error) {
    DEBUG(error);
  }
});
