import assert from "/src/common/assert.js";
import * as Status from "/src/common/status.js";
import FeedStore from "/src/feed-store/feed-store.js";

// TODO: think of how to reduce connection usage, maybe maintain a persistent connection? Then
// again now that this is non-blocking, maybe the slowness of it does not matter?

let isRequestPending = false;

// Updates the text of the application's badge. Non-blocking.
export default async function updateBadgeText() {
  if(isRequestPending) {
    console.warn('updateBadgeText request already pending');
    return Status.EINVALIDSTATE;
  }

  isRequestPending = true;

  const store = new FeedStore();
  let status = await store.open();
  if(status !== Status.OK) {
    console.error('Failed to open database to count unread entries');
    isRequestPending = false;
    return status;
  }

  let count;
  [status, count] = await store.countUnreadEntries();
  if(status !== Status.OK) {
    console.error('Failed to count unread entries, status was ', status);
    isRequestPending = false;
    store.close();
    return status;
  }

  isRequestPending = false;
  store.close();

  const text = count > 999 ? '1k+' : '' + count;

  console.debug('Setting badge text to', text);
  chrome.browserAction.setBadgeText({text: text});
  return Status.OK;
}
