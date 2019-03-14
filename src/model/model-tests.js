import {assert} from '/src/assert.js';
import {INDEFINITE} from '/src/deadline.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_entry from '/src/model/ops/create-entry.js';
import create_feed from '/src/model/ops/create-feed.js';
import get_entry from '/src/model/ops/get-entry.js';
import get_feed from '/src/model/ops/get-feed.js';
import {Entry, is_entry} from '/src/model/types/entry.js';
import {Feed, is_feed} from '/src/model/types/feed.js';

export async function get_feeds_test() {
  const db_name = 'get-feeds-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const n = 5;           // number of feeds to store and test against
  let active_count = 0;  // track number of not-inactive
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new Feed();
    const url = new URL('a://b.c' + i);
    feed.appendURL(url);
    // make some inactive
    if (i % 2 === 0) {
      feed.active = false;
    } else {
      active_count++;
    }
    const promise = create_feed(model, feed);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);
  const unsorted = await model.getFeeds('all', false);
  assert(unsorted.length === n);
  for (const feed of unsorted) {
    assert(feed);
  }
  const sorted = await model.getFeeds('all', true);
  assert(sorted.length === n);
  for (const feed of sorted) {
    assert(feed);
  }
  const actives = await model.getFeeds('active', false);
  assert(actives.length === active_count);
  for (const feed of actives) {
    assert(feed);
    assert(feed.active);
  }
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function iterate_entries_test() {
  const db_name = 'iterate-entries-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = new Entry();
    entry.title = 'test' + i;
    const promise = create_entry(model, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  let num_iterated = 0;
  await model.iterateEntries(entry => {
    assert(entry);
    num_iterated++;
  });
  assert(num_iterated === n);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function set_entry_read_state_test() {
  const db_name = set_entry_read_state_test.name;
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const entry = new Entry();
  entry.readState = Entry.UNREAD;
  const id = await create_entry(model, entry);
  let stored_entry = await get_entry(model, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.UNREAD);
  await model.setEntryReadState(id, true);
  stored_entry = undefined;
  stored_entry = await get_entry(model, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.READ);

  // Now mark it again as unread, and assert
  await model.setEntryReadState(id, false);
  stored_entry = undefined;
  stored_entry = await get_entry(model, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.UNREAD);

  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function query_entries_test() {
  const db_name = 'query-entries-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();

  const create_promises = [];
  let entry;

  // Create 5 unread entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = create_entry(model, entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.READ;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = create_entry(model, entry);
    create_promises.push(promise);
  }

  // Create 5 unread entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = create_entry(model, entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.READ;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = create_entry(model, entry);
    create_promises.push(promise);
  }

  // Wait until all creation is complete
  await Promise.all(create_promises);

  let entries;
  let query;

  // Query for all entries, assert that it finds the expected number of
  // entries. Also test an undefined query parameter here.
  entries = await model.queryEntries();
  assert(entries.length === 20);

  // Query for all unread entries, assert that it finds the expected number of
  // entries
  query = {read_state: Entry.UNREAD};
  entries = await model.queryEntries(query);
  assert(entries.length === 10);

  // Query for all read entries, assert that it finds the expected number of
  // entries
  query = {read_state: Entry.READ};
  entries = await model.queryEntries(query);
  assert(entries.length === 10);

  // Query using reverse direction. Assert that entries are returned in the
  // expected order.
  query = {direction: 'DESC'};
  entries = await model.queryEntries(query);
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
  entries = await model.queryEntries(query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an offset one less than the max
  query = {offset: 19};
  entries = await model.queryEntries(query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an arbitrary offset
  query = {offset: 11};
  entries = await model.queryEntries(query);
  assert(entries.length === 20 - query.offset);

  // Query using a limit greater than the number of existing entries
  query = {offset: 50000};
  entries = await model.queryEntries(query);
  assert(entries.length === 0);

  // Query using a limit without an offset
  query = {limit: 10};
  entries = await model.queryEntries(query);
  assert(entries.length <= 10);

  // Query using the smallest limit
  query = {limit: 1};
  entries = await model.queryEntries(query);
  assert(entries.length <= 1);

  // Query using offset and the smallest limit
  query = {offset: 10, limit: 1};
  entries = await model.queryEntries(query);
  assert(entries.length <= 1);

  // Query using limit greater than number of entries
  query = {limit: 9001};
  entries = await model.queryEntries(query);
  assert(entries.length === 20);

  // Query using an arbitrary offset and an arbitrary limit
  query = {offset: 5, limit: 8};
  entries = await model.queryEntries(query);
  assert(entries.length === 8);

  // Query using feed1
  query = {feed_id: 1};
  entries = await model.queryEntries(query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 1);
  }

  // Query using feed2
  query = {feed_id: 2};
  entries = await model.queryEntries(query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 2);
  }

  // Query using particular feed unread only
  query = {feed_id: 1, read_state: Entry.UNREAD};
  entries = await model.queryEntries(query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === Entry.UNREAD);
  }

  // Feed 1 read only
  query = {feed_id: 1, read_state: Entry.READ};
  entries = await model.queryEntries(query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === Entry.READ);
  }

  // Feed 1, unread, offset 3
  query = {feed_id: 1, read_state: Entry.UNREAD, offset: 3};
  entries = await model.queryEntries(query);
  assert(entries.length === 2);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === Entry.UNREAD);
  }

  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function update_entry_test() {
  const db_name = 'update-entry-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();

  let entry = new Entry();
  entry.title = 'first-title';
  const entry_id = await create_entry(model, entry);
  entry = await get_entry(model, 'id', entry_id, false);
  entry.title = 'second-title';
  await model.updateEntry(entry);
  entry = await get_entry(model, 'id', entry_id, false);
  assert(entry.title === 'second-title');
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function update_feed_test() {
  const db_name = 'update-feed-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  let feed = new Feed();
  feed.title = 'first';
  const url = new URL('a://b.c');
  feed.appendURL(url);
  let new_id = await create_feed(model, feed);
  feed.id = new_id;
  feed.title = 'second';
  await model.updateFeed(feed, true);
  feed = undefined;  // paranoia
  feed = await get_feed(model, 'id', new_id, false);
  assert(feed.title = 'second');
  model.close();
  await indexeddb_utils.remove(db_name);
}
