import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {setBadgeText} from "/src/platform/platform.js";

// NOTE: I've refactored this several times to share or not share the connection. Currently I've
// decided it should not share, and instead should manage its own connection. The key reason is that
// this makes the function non-blocking. The insight is that the callers of this function do not
// care if this function completes immediately. The callers only care that it completes eventually.
// A second insight is that this is a count. There isn't really a problem if counts resolve out of
// order.

// TODO: many callers might call this at once, particularly in the case of polling feeds, leading
// to outstanding concurrent requests, which is kind of a waste. Think of how to coordinate so that
// if one outstanding (pending) request exists that new ones are not created and instead join the
// existing request.
// TODO: think of how to reduce connection usage, maybe maintain a persistent connection? Then
// again now that this is non-blocking, maybe the slowness of it does not matter?

export default async function updateBadgeText() {
  const store = new FeedStore();
  let count;
  try {
    await store.open();
    count = await store.countUnreadEntries();
  } finally {
    store.close();
  }
  const text = count > 999 ? '1k+' : '' + count;

  // Comment or uncomment for debugging
  // console.debug('Setting badge text to', text);

  setBadgeText(text);
}
