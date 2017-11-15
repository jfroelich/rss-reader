// Scans entries in the database and archives some of them

import assert from "/src/assert.js";
import {ENTRY_STATE_ARCHIVED} from "/src/entry.js";
import {isPosInt} from "/src/number.js";
import * as rdb from "/src/rdb.js";
import sizeof from "/src/sizeof.js";

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Archives certain entries in the database
// @param maxAgeMs {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
export default async function archiveEntries(conn, maxAgeMs, limit) {
  assert(rdb.isOpen(conn));

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = TWO_DAYS_MS;
  }

  assert(isPosInt(maxAgeMs));

  const currentDate = new Date();
  function isArchivable(entry) {
    const entryAgeMs = currentDate - entry.dateCreated;
    return entryAgeMs > maxAgeMs;
  }

  const entries = await rdb.findArchivableEntries(conn, isArchivable, limit);

  if(!entries.length) {
    console.debug('no archivable entries found');
    return;
  }

  // Concurrently archive and store each entry
  // This uses Promise.all over promiseEvery because this should fail at the first failure,
  // because usually that indicates a fatal-like database error, and there is little point to
  // trying to continue as the other promises are probably also going to fail. However, this does
  // leave the data in a potentially inconsistent state, where only some entries were archived
  // prior to the error. However, this function accepts a limit, so the caller understands there
  // is only partial success, so it is not too big of a deal.

  const channel = new BroadcastChannel('db');
  const promises = [];
  for(const entry of entries) {
    promises.push(archiveEntry(entry, conn, channel));
  }

  try {
    await Promise.all(promises);
  } finally {
    channel.close();
  }

  console.log('compacted %s entries', entries.length);
}

async function archiveEntry(entry, conn, channel) {
  const beforeSize = sizeof(entry);
  const compacted = compactEntry(entry);
  compacted.dateUpdated = new Date();
  const afterSize = sizeof(compacted);
  console.debug('before %d after %d', beforeSize, afterSize);
  await rdb.putEntry(conn, entry);
  const message = {type: 'archived-entry', id: compacted.id};
  channel.postMessage(message);
  return compacted;
}

// Returns a new entry object that is in a compacted form. The new entry is a shallow copy of the
// input entry, where only certain properties are kept, and a couple properties are changed.
function compactEntry(entry) {
  const ce = {};
  ce.dateCreated = entry.dateCreated;
  ce.dateRead = entry.dateRead;
  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  ce.dateArchived = new Date();
  return ce;
}
