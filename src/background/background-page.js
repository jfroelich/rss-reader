import "/src/background/alarms.js";
import "/src/background/cli.js";
import FaviconCache from "/src/favicon/cache.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {
  addBadgeClickListener,
  addInstallListener,
  showSlideshowTab
} from "/src/platform/platform.js";
import updateBadgeText from "/src/reader/update-badge-text.js";

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
