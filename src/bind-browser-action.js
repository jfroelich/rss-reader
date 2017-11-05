'use strict';

// import base/extension.js

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await extensionShowSlideshowTab();
  } catch(error) {
    console.warn(error);
  }
});
