import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {setBadgeText} from "/src/platform/platform.js";

export default async function updateBadgeText(store) {
  assert(store instanceof FeedStore);
  assert(store.isOpen());

  const count = await store.countUnreadEntries();
  const text = count > 999 ? '1k+' : '' + count;

  // Comment or uncomment for debugging
  // console.debug('Setting badge text to', text);

  setBadgeText(text);
}
