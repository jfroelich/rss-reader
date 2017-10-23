'use strict';

// import base/extension.js

// This file should only be loaded in the extension background

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await extension_show_slideshow_tab();
  } catch(error) {
    console.warn(error);
  }
});
