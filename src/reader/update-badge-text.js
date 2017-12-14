import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {setBadgeText} from "/src/platform/platform.js";

const DEBUG = false;
const dprintf = DEBUG ? console.log : function () {};

// @param store {FeedStore} an open FeedStore instance
export default async function updateBadgeText(store) {
  assert(store instanceof FeedStore);
  assert(store.isOpen());
  const count = await store.countUnreadEntries();
  const text = count > 999 ? '1k+' : '' + count;
  dprintf('Setting badge text to', text);
  setBadgeText(text);
}
