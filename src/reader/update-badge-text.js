import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {setBadgeText} from "/src/platform/platform.js";

// TODO: think of how to reduce connection usage, maybe maintain a persistent connection? Then
// again now that this is non-blocking, maybe the slowness of it does not matter?

// TODO: test
let isRequestPending = false;

// Updates the text of the application's badge. Non-blocking.
export default async function updateBadgeText() {
  if(isRequestPending) {
    console.debug('Ignoring call to updateBadgeText given request already pending');
    return;
  }

  isRequestPending = true;

  const store = new FeedStore();
  let count;
  try {
    await store.open();
    count = await store.countUnreadEntries();
  } finally {
    isRequestPending = false;
    store.close();
  }
  const text = count > 999 ? '1k+' : '' + count;
  setBadgeText(text);
}
