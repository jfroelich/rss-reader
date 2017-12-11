import assert from "/src/assert/assert.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Entry from "/src/reader-db/entry.js";
import {InvalidStateError, NotFoundError} from "/src/reader-db/errors.js";
import findEntryByIdInDb from "/src/reader-db/find-entry-by-id.js";
import putEntryInDb from "/src/reader-db/put-entry.js";
import {isOpen} from "/src/indexeddb/utils.js";
import check from "/src/utils/check.js";

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
export default async function main(conn, id) {
  assert(isOpen(conn));
  assert(Entry.isValidId(id));

  const entry = await findEntryByIdInDb(conn, id);

  // The entry should ALWAYS have a url
  assert(Entry.hasURL(entry));

  // TODO: possibly change check to assert to represent that the error is unexpected instead of
  // expected.
  // I have mixed feelings about whether these should be checks or asserts. On the one hand, the
  // database should never enter into an invalid state, so these should be assertions. On the other
  // hand, the database is external and difficult to reason about statically, and in some sense
  // entries are user data as opposed to system data, so bad data is expected.
  //
  // The slideshow page, which calls this function, currently is kind of sloppy and does not do
  // a great job reasoning about database state. There are a few situations where an entry may be
  // deleted, such as by a background task, and the slideshow never the less calls this
  // function unaware. Until the time the slideshow can properly reflect the state of the model
  // consistently, this is better done as a check than an assert.
  check(entry, NotFoundError, id);

  // TODO: I am not sure this check is strict enough. Technically the entry should always be
  // in the UNREAD state at this point.
  check(entry.readState !== Entry.STATE_READ, InvalidStateError,
    'Entry %d already in read state', id);

  const url = Entry.peekURL(entry);
  console.debug('Found entry to mark as read', id, url);

  // We have full control over the entry object from read to write, so there is no need to sanitize
  // or filter empty properties.
  entry.readState = Entry.STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;
  await putEntryInDb(conn, entry);
  console.debug('Marked entry as read', id, url);
  await updateBadgeText(conn);
}
