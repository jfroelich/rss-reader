import showSlideshowTab from "/src/show-slideshow-tab.js";

import "/src/background-page/alarms.js";
import "/src/background-page/cli.js";
import FaviconCache from "/src/favicon/cache.js";
import FeedStore from "/src/feed-store/feed-store.js";
import updateBadgeText from "/src/reader/update-badge-text.js";


function addInstallListener(listener) {
  chrome.runtime.onInstalled.addListener(listener);
}

function addBadgeClickListener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}

console.debug('Initializing background page');

addInstallListener(async function(event) {
  console.debug('onInstalled', event);

  // TODO: these two tasks are independent, why make the second wait on the first to resolve?

  const store = new FeedStore();
  try {
    await store.setup();
  } catch(error) {
    console.warn(error);
  }

  const fic = new FaviconCache();
  try {
    await fic.setup();
  } catch(error) {
    console.warn(error);
  }
});

addBadgeClickListener(function(event) {
  showSlideshowTab();
});

updateBadgeText();
