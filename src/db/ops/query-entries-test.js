import Entry from '/src/db/entry.js';
import create_entry from '/src/db/ops/create-entry.js';
import query_entries from '/src/db/ops/query-entries.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function query_entries_test() {
  const db_name = 'query-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const create_promises = [];
  let entry;

  // Create 5 unread entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.feed = 1;
    entry.datePublished = new Date();
    create_promises.push(create_entry(conn, entry));
  }

  // Create 5 read entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.READ;
    entry.feed = 1;
    entry.datePublished = new Date();
    create_promises.push(create_entry(conn, entry));
  }

  // Create 5 unread entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.feed = 2;
    entry.datePublished = new Date();
    create_promises.push(create_entry(conn, entry));
  }

  // Create 5 read entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.READ;
    entry.feed = 2;
    entry.datePublished = new Date();
    create_promises.push(create_entry(conn, entry));
  }

  // Wait until all creation is complete
  await Promise.all(create_promises);

  let entries;
  let query;

  // Query for all entries, assert that it finds the expected number of
  // entries. Also test an undefined query parameter here.
  entries = await query_entries(conn);
  assert(entries.length === 20);

  // Query for all unread entries, assert that it finds the expected number of
  // entries
  query = {read_state: Entry.UNREAD};
  entries = await query_entries(conn, query);
  assert(entries.length === 10);

  // Query for all read entries, assert that it finds the expected number of
  // entries
  query = {read_state: Entry.READ};
  entries = await query_entries(conn, query);
  assert(entries.length === 10);

  // Query using reverse direction. Assert that entries are returned in the
  // expected order.
  query = {direction: 'DESC'};
  entries = await query_entries(conn, query);
  // Walk the array. When querying by DESC order, each entry's datePublished
  // value should be greater than or equal to the next one
  for (let i = 0; i < entries.length - 1; i++) {
    const entry1 = entries[i];
    const entry2 = entries[i + 1];
    assert(entry1.datePublished >= entry2.datePublished);
  }

  // Query using an offset and no limit. Here choose the smallest offset that
  // is not 0.
  query = {offset: 1};
  entries = await query_entries(conn, query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an offset one less than the max
  query = {offset: 19};
  entries = await query_entries(conn, query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an arbitrary offset
  query = {offset: 11};
  entries = await query_entries(conn, query);
  assert(entries.length === 20 - query.offset);

  // Query using a limit greater than the number of existing entries
  query = {offset: 50000};
  entries = await query_entries(conn, query);
  assert(entries.length === 0);

  // Query using a limit without an offset
  query = {limit: 10};
  entries = await query_entries(conn, query);
  assert(entries.length <= 10);

  // Query using the smallest limit
  query = {limit: 1};
  entries = await query_entries(conn, query);
  assert(entries.length <= 1);

  // Query using offset and the smallest limit
  query = {offset: 10, limit: 1};
  entries = await query_entries(conn, query);
  assert(entries.length <= 1);

  // Query using limit greater than number of entries
  query = {limit: 9001};
  entries = await query_entries(conn, query);
  assert(entries.length === 20);

  // Query using an arbitrary offset and an arbitrary limit
  query = {offset: 5, limit: 8};
  entries = await query_entries(conn, query);
  assert(entries.length === 8);

  // Query using feed1
  query = {feed_id: 1};
  entries = await query_entries(conn, query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 1);
  }

  // Query using feed2
  query = {feed_id: 2};
  entries = await query_entries(conn, query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 2);
  }

  // Query using particular feed unread only
  query = {feed_id: 1, read_state: Entry.UNREAD};
  entries = await query_entries(conn, query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === Entry.UNREAD);
  }

  // Feed 1 read only
  query = {feed_id: 1, read_state: Entry.READ};
  entries = await query_entries(conn, query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === Entry.READ);
  }

  // Feed 1, unread, offset 3
  query = {feed_id: 1, read_state: Entry.UNREAD, offset: 3};
  entries = await query_entries(conn, query);
  assert(entries.length === 2);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === Entry.UNREAD);
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}
