import * as Status from "/src/common/status.js";
import sizeof from "/src/feed-ops/sizeof.js";
import * as Entry from "/src/feed-store/entry.js";
import {findArchivableEntries, putEntry} from "/src/feed-store/feed-store.js";

// TODO: connect locally? I want to be able to run on test, but there is no need to
// share the connection, and conn boilerplate. Maybe accept dbinfo parameter instead?
// TODO: channelName parameter rather than define locally

// Archives certain entries in the database
// - store {FeedStore} storage database
// - maxAgeMs {Number} how long before an entry is considered archivable (using date entry
// created), in milliseconds
// - limit {Number} maximum number of entries to archive
export default async function archiveEntries(conn, maxAgeMs, limit) {
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

  const [status, entries] = await findArchivableEntries(conn, isArchivable, limit);
  if(status !== Status.OK) {
    console.error('Failed to find archivable entries:', Status.toString(status));
    return status;
  }

  if(!entries.length) {
    return Status.OK;
  }

  const channel = new BroadcastChannel('reader');
  const promises = [];
  for(const entry of entries) {
    promises.push(archiveEntry(conn, channel, entry));
  }

  // If any fail, return an error, even though some may have committed.
  const resolutions = await Promise.all(promises);
  for(const resolution of resolutions) {
    if(resolution !== Status.OK) {
      console.error('Failed to put at least one entry:', Status.toString(resolution));
      channel.close();
      return resolution;
    }
  }

  channel.close();

  console.log('Compacted %s entries', entries.length);
  return Status.OK;
}

// Given an entry, compact it, store it, notify observers
async function archiveEntry(conn, channel, entry) {
  const beforeSize = sizeof(entry);
  const compactedEntry = compactEntry(entry);
  const afterSize = sizeof(compactedEntry);
  console.debug('Changed approx entry size from %d to %d', beforeSize, afterSize);

  compactedEntry.archiveState = Entry.STATE_ARCHIVED;
  compactedEntry.dateArchived = new Date();
  compactedEntry.dateUpdated = new Date();

  const [status] = await putEntry(conn, compactedEntry);
  if(status !== Status.OK) {
    console.error('Failed to put entry:', Status.toString(status));
    return status;
  }

  channel.postMessage({type: 'entry-archived', id: compactedEntry.id});
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
