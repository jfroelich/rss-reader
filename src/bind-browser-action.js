// import extension.js

import {showSlideshowTab} from "/src/extension.js";

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await showSlideshowTab();
  } catch(error) {
    console.warn(error);
  }
});
