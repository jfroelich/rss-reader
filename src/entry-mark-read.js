// Marks an entry as read in the database

import assert from "/src/utils/assert.js";
import * as Entry from "/src/entry.js";
import {check} from "/src/utils/errors.js";
import * as rdb from "/src/rdb.js";
import updateBadgeText from "/src/update-badge-text.js";

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
export default async function entryMarkRead(conn, id) {
  assert(rdb.isOpen(conn));
  assert(Entry.isValidId(id));

  const entry = await rdb.findEntryById(conn, id);

  // I have mixed feelings about whether these should be checks or asserts. On the one hand, the
  // database should never enter into an invalid state, so these should be assertions. On the other
  // hand, the database is external and difficult to reason about statically, and in some sense
  // entries are user data as opposed to system data, so this should tolerate bad data.

  // The slideshow page, which calls this function, currently is kind of sloppy and does not do
  // a great job reasoning about database state. There are a few situations where an entry may be
  // deleted somehow, such as by a background task, and the slideshow never the less calls this
  // function unaware. Until the time the slideshow can properly reflect the state of the model
  // consistently, this is better done as a check than an assert.
  check(entry, rdb.NotFoundError, '' + id);

  // TODO: I am not sure this check is strict enough. Technically the entry should always be
  // in the UNREAD state at this point.
  check(entry.readState !== Entry.STATE_READ, rdb.InvalidStateError,
    'entry ' + id + ' already in read state');

  // The entry should ALWAYS have a url
  assert(Entry.hasURL(entry));

  const url = Entry.peekURL(entry);
  console.debug('found entry to mark with url', url);

  // We have full control over the entry object from read to write, so there is no need to sanitize
  // or filter empty properties.
  entry.readState = Entry.STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;
  await rdb.putEntry(conn, entry);
  console.debug('marked entry as read with url', url);
  await updateBadgeText(conn);
}
