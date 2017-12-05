import assert from "/src/assert/assert.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import * as Entry from "/src/reader-db/entry.js";
import findArchivableEntriesInDb from "/src/reader-db/find-archivable-entries.js";
import putEntryInDb from "/src/reader-db/put-entry.js";
import isPosInt from "/src/utils/is-pos-int.js";
import sizeof from "/src/utils/sizeof.js";

const CHANNEL_NAME = 'reader';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Archives certain entries in the database
// @param maxAgeMs {Number} how long before an entry is considered archivable (using date entry
// created), in milliseconds
export default async function archiveEntries(conn, maxAgeMs, limit) {
  assert(IndexedDbUtils.isOpen(conn));

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = TWO_DAYS_MS;
  }

  assert(isPosInt(maxAgeMs));

  const currentDate = new Date();
  function isArchivable(entry) {
    const entryAgeMs = currentDate - entry.dateCreated;
    return entryAgeMs > maxAgeMs;
  }

  const entries = await findArchivableEntriesInDb(conn, isArchivable, limit);
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

  const channel = new BroadcastChannel(CHANNEL_NAME);
  const promises = [];
  for(const entry of entries) {
    promises.push(archiveEntry(entry, conn, channel));
  }

  try {
    await Promise.all(promises);
  } finally {
    channel.close();
  }

  console.log('Compacted %s entries', entries.length);
}

async function archiveEntry(entry, conn, channel) {
  const beforeSize = sizeof(entry);
  const compacted = compactEntry(entry);
  compacted.dateUpdated = new Date();
  const afterSize = sizeof(compacted);
  console.debug('before %d after %d', beforeSize, afterSize);
  await putEntryInDb(conn, compacted);
  const message = {type: 'entry-archived', id: compacted.id};
  channel.postMessage(message);
  return compacted;
}

// Returns a new entry object that is in a compacted form. The new entry is a shallow copy of the
// input entry, where only certain properties are kept, and a couple properties are changed.
function compactEntry(entry) {

  // Consistently create the entry using the createEntry method, instead of creating a generic
  // object, so that any implicit fields and such are present.
  //
  // This function requires in depth knowledge of the entry object type. I could choose to inline
  // the internals of createEntry here based on that reason. However, I still want some abstraction
  // and am not entirely happy about how much knowledge this function has of entry properties. On
  // the other hand, the concept of compacting an entry is distinct to this module, and not a
  // general concern of entries.
  // TODO: maybe the best way to alleviate the above concern is to have a proxy. Design an
  // intermediate module called compact-entry.js. It would be an extension of the general entry.js
  // module that introduces the compact transform concept to entries. Then the archive entries
  // module calls to it. That seems like a nice trade off. On the other hand, this starts to create
  // a lot of layers and a lot of files. At least for now I am going to leave it as is.
  const ce = Entry.createEntry();

  ce.dateCreated = entry.dateCreated;
  ce.dateRead = entry.dateRead;
  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  ce.archiveState = Entry.STATE_ARCHIVED;
  ce.dateArchived = new Date();
  return ce;
}
