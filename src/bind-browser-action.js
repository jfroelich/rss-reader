'use strict';

// import base/extension.js

// This file should only be loaded in the extension background

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await extensionShowSlideshowTab();
  } catch(error) {
    console.warn(error);
  }
});
