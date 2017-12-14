import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as Entry from "/src/reader-db/entry.js";

const CHANNEL_NAME = 'reader';

// Scans the database for entries missing urls are removes them
// @param store {FeedStore} an open FeedStore instance
// @param limit {Number} optional, if specified should be positive integer > 0
// @throws Error - database related
export default async function removeLostEntries(store, limit) {
  assert(store instanceof FeedStore);
  assert(store.isOpen());

  const entries = await store.findEntries(isLostEntry, limit);
  console.debug('Found %s lost entries', entries.length);
  if(entries.length === 0) {
    return;
  }

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  await store.removeEntries(ids);
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}

function isLostEntry(entry) {
  return !Entry.hasURL(entry);
}
