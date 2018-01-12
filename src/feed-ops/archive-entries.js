import * as Status from "/src/common/status.js";
import sizeof from "/src/feed-ops/sizeof.js";
import * as Entry from "/src/feed-store/entry.js";
import FeedStore from "/src/feed-store/feed-store.js";

// TODO: create store locally? I want to be able to run on test, but there is no need to
// share the connection, and conn boilerplate. Maybe accept dbinfo parameter instead?


// Archives certain entries in the database
// - store {FeedStore} storage database
// - maxAgeMs {Number} how long before an entry is considered archivable (using date entry
// created), in milliseconds
// - limit {Number} maximum number of entries to archive
export default async function archiveEntries(store, maxAgeMs, limit) {
  if(!store.isOpen()) {
    console.error('store is not open');
    return Status.EINVALIDSTATE;
  }

  if(typeof maxAgeMs === 'undefined') {
    const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
    maxAgeMs = TWO_DAYS_MS;
  }

  if(!Number.isInteger(maxAgeMs) || maxAgeMs < 0) {
    console.error('Invalid maxAgeMs argument', maxAgeMs);
    return Status.EINVAL;
  }


  // TODO: rather than pass a predicate, just pass params to findArchivableEntries
  // and let it compose the function if needed
  const currentDate = new Date();
  function isArchivable(entry) {
    const entryAgeMs = currentDate - entry.dateCreated;
    return entryAgeMs > maxAgeMs;
  }

  const [status, entries] = await store.findArchivableEntries(isArchivable, limit);
  if(status !== Status.OK) {
    console.error('Failed to find archivable entries with status ' + status);
    return status;
  }

  if(!entries.length) {
    console.debug('No archivable entries found');
    return Status.OK;
  }

  const channel = new BroadcastChannel('reader');
  const promises = [];
  for(const entry of entries) {
    promises.push(archiveEntry(store, channel, entry));
  }

  // If any fail, return an error, even though some may have committed.
  const resolutions = await Promise.all(promises);
  for(const resolution of resolutions) {
    if(resolution !== Status.OK) {
      console.error('Failed to put at least one entry with status', resolution);
      channel.close();
      return resolution;
    }
  }

  channel.close();

  console.log('Compacted %s entries', entries.length);
  return Status.OK;
}

// Given an entry, compact it, store it, notify observers
async function archiveEntry(store, channel, entry) {
  if(!Entry.isEntry(entry)) {
    console.error('Invalid entry argument', entry);
    return Status.EINVAL;
  }

  const beforeSize = sizeof(entry);
  const compactedEntry = compactEntry(entry);
  const afterSize = sizeof(compactedEntry);
  console.debug('Compact entry changed approx size from %d to %d', beforeSize, afterSize);

  compactedEntry.archiveState = Entry.STATE_ARCHIVED;
  compactedEntry.dateArchived = new Date();

  compactedEntry.dateUpdated = new Date();
  const [status] = await store.putEntry(compactedEntry);
  if(status !== Status.OK) {
    console.error('Failed to put entry with status', status);
    return status;
  }

  const message = {type: 'entry-archived', id: compactedEntry.id};
  channel.postMessage(message);

  return Status.OK;
}

// Create a new entry and copy over certain fields
function compactEntry(entry) {
  const compactedEntry = Entry.createEntry();
  compactedEntry.dateCreated = entry.dateCreated;

  if(entry.dateRead) {
    compactedEntry.dateRead = entry.dateRead;
  }

  compactedEntry.feed = entry.feed;
  compactedEntry.id = entry.id;
  compactedEntry.readState = entry.readState;
  compactedEntry.urls = entry.urls;
  return compactedEntry;
}
