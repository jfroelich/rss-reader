import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Entry from "/src/reader-db/entry.js";
import {InvalidStateError, NotFoundError} from "/src/reader-db/errors.js";
import {isOpen} from "/src/indexeddb/utils.js";
import check from "/src/utils/check.js";

const DEBUG = false;
const dprintf = DEBUG ? console.log : function noop() {};

// TODO: change to accept store as input instead of conn

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
export default async function main(conn, id) {
  assert(isOpen(conn));
  assert(Entry.isValidId(id));

  // TEMP: hacky solution to requiring store
  // TODO: clean this up, hackish, change this to accept store as input or something
  const store = new FeedStore();
  store.conn = conn;

  const entry = await store.findEntryById(id);

  // The entry should always be found
  // TODO: use stricter type check (implicit magic)
  assert(typeof entry !== 'undefined');

  // The entry should ALWAYS have a url
  assert(Entry.hasURL(entry));

  // TODO: I am not sure this check is strict enough. Technically the entry should always be
  // in the UNREAD state at this point.
  check(entry.readState !== Entry.STATE_READ, InvalidStateError,
    'Entry %d already in read state', id);

  const url = Entry.peekURL(entry);
  dprintf('Found entry to mark as read', id, url);

  // We have full control over the entry object from read to write, so there is no need to sanitize
  // or filter empty properties.
  entry.readState = Entry.STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  await store.putEntry(entry);
  dprintf('Marked entry as read', id, url);
  await updateBadgeText(store);
}
