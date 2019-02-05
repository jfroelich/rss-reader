import {assert} from '/src/assert.js';
import * as db from '/src/db.js';
import * as idb from '/src/idb.js';

export async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  await conn.archive_entries(100);
  conn.close();
  await idb.remove(db_name);
}

export async function count_unread_entries_by_feed_test() {
  const db_name = 'count-unread-entries-by-feed-test';
  await idb.remove(db_name);

  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const feed = new db.Feed();
  const url = new URL('http://www.example.com/feed.xml');
  feed.appendURL(url);
  const feed_id = await conn.create_feed(feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state = i === 0 ? db.ENTRY_UNREAD : db.ENTRY_READ;
    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = new db.Entry();
      entry.feed = feed_id;
      entry.readState = read_state;
      const promise = conn.create_entry(entry);
      create_promises.push(promise);
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await conn.count_unread_entries_by_feed(feed_id);
  assert(unread_count === num_entries_created_per_type);

  const bad_id = 123456789;
  unread_count = await conn.count_unread_entries_by_feed(bad_id);
  assert(unread_count === 0);
  conn.close();
  await idb.remove(db_name);
}

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  await idb.remove(db_name);

  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  let count = await conn.count_unread_entries();
  assert(0 === count);

  // Generate some unread entries
  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = new db.Entry();
    entry.readState = db.ENTRY_UNREAD;
    entry.appendURL(new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  // Generate some read entries
  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = new db.Entry();
    entry.readState = db.ENTRY_READ;
    entry.appendURL(new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  // Store both the read and unread entries
  const insert_promises = [];
  for (const entry of entries_to_insert) {
    insert_promises.push(conn.create_entry(entry));
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await conn.count_unread_entries();
  assert(count === insert_unread_count);

  conn.close();
  await idb.remove(db_name);
}

export async function create_entry_test() {
  const db_name = 'create-entry-test';
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const entry = new db.Entry();
  const id = await conn.create_entry(entry);
  const stored_entry = await conn.get_entry('id', id, false);
  assert(stored_entry);
  assert(db.is_entry(stored_entry));
  assert(stored_entry.id === id);
  conn.close();
  await idb.remove(db_name);
}

export async function create_feed_test() {
  const db_name = 'create-feed-test';
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const feed = new db.Feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  feed.appendURL(feed_url);
  const stored_feed_id = await conn.create_feed(feed);
  assert(db.Feed.isValidId(stored_feed_id));
  let stored_feed = await conn.get_feed('url', feed_url, true);
  assert(db.is_feed(stored_feed));
  stored_feed = await conn.get_feed('id', stored_feed_id, false);
  assert(db.is_feed(stored_feed));
  conn.close();
  await idb.remove(db_name);
}

export async function create_feed_url_constraint_test() {
  const db_name = 'create-feed-url-constraint-test';
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const feed1 = new db.Feed();
  feed1.appendURL(new URL('http://www.example.com/example.rss'));
  const feed2 = new db.Feed();
  feed2.appendURL(new URL('http://www.example.com/example.rss'));

  await conn.create_feed(feed1);
  let create_error;
  try {
    await conn.create_feed(feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails as expected
  assert(create_error instanceof DOMException);
  conn.close();
  await idb.remove(db_name);
}

export async function create_feeds_test() {
  const db_name = 'create-feeds-test';
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = new db.Feed();
    feed.appendURL(new URL('a://b.c' + i));
    feeds.push(feed);
  }
  const ids = await conn.create_feeds(feeds);
  assert(ids.length === num_feeds);
  const stored_feeds = await conn.get_feeds('all', false);
  assert(stored_feeds.length === num_feeds);
  const get_proms = ids.map(id => conn.get_feed('id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(db.is_feed(feed));
    assert(db.Feed.isValidId(feed.id));
  }
  conn.close();
  await idb.remove(db_name);
}

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const entry1 = new db.Entry();
  const url1 = new URL('https://www.example1.com');
  entry1.appendURL(url1);

  const entry2 = new db.Entry();
  const url2 = new URL('https://www.example2.com');
  entry2.appendURL(url2);

  const entry_id1 = await conn.create_entry(entry1);
  const entry_id2 = await conn.create_entry(entry2);
  let stored_entry = await conn.get_entry('id', entry_id1, false);
  assert(stored_entry);
  await conn.delete_entry(entry_id1, 'test');
  stored_entry = undefined;
  stored_entry = await conn.get_entry('id', entry_id1, false);
  assert(!stored_entry);
  stored_entry = undefined;
  stored_entry = await conn.get_entry('id', entry_id2, false);
  assert(stored_entry);
  conn.close();
  await idb.remove(db_name);
}

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const feed1 = new db.Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await conn.create_feed(feed1);
  const feed2 = new db.Feed();
  const url2 = new URL('http://www.example.com/bar.xml');
  feed2.appendURL(url2);
  const feed_id2 = await conn.create_feed(feed2);
  await conn.delete_feed(feed_id1);
  const stored_feed1 = await conn.get_feed('id', feed_id1, false);
  assert(!stored_feed1);
  const stored_feed2 = await conn.get_feed('id', feed_id2, false);
  assert(stored_feed2);
  const bad_id = 123456789;
  await conn.delete_feed(bad_id);
  await conn.delete_feed(feed_id2);
  conn.close();
  await idb.remove(db_name);
}

export async function is_entry_test() {
  const correct = new db.Entry();
  assert(db.is_entry(correct));
  assert(!db.is_feed(correct));
  const nomagic = {};
  assert(!db.is_entry(nomagic));
}

export async function append_entry_url_test() {
  const entry = new db.Entry();
  assert(entry.urls === undefined || entry.urls.length === 0);
  entry.appendURL(new URL('a://b.c1'));
  assert(entry.urls);
  assert(entry.urls.length === 1);
  const url2 = new URL('a://b.c2');
  let appended = entry.appendURL(url2);
  assert(entry.urls.length === 2);
  assert(appended === true);
  appended = false;
  appended = entry.appendURL(url2);
  assert(entry.urls.length === 2);
  assert(appended === false);
  assert(db.is_entry(entry));
}

export async function is_feed_test() {
  const fcorrect = new db.Feed();
  assert(db.is_feed(fcorrect));
  assert(!db.is_entry(fcorrect));
  const nomagic = {};
  assert(!db.is_feed(nomagic));
}

export async function append_feed_url_test() {
  const feed = new db.Feed();
  assert(!feed.hasURL());  // precondition
  feed.appendURL(new URL('a://b.c1'));
  assert(feed.hasURL());  // expect change
  const url2 = new URL('a://b.c2');
  feed.appendURL(url2);
  assert(feed.urls.length === 2);  // expect increment
  feed.appendURL(url2);
  assert(feed.urls.length === 2);  // expect no change
  assert(db.is_feed(feed));        // modifications preserved type
}

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  const entry = new db.Entry();
  entry.title = 'test';
  const entry_id = await conn.create_entry(entry);
  const stored_entry = await conn.get_entry('id', entry_id, false);
  assert(stored_entry);
  const bad_id = 123456789;
  const bad_entry = await conn.get_entry('id', bad_id, false);
  assert(bad_entry === undefined);
  conn.close();
  await idb.remove(db_name);
}

export async function get_entries_test() {
  const db_name = 'get-entries-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = new db.Entry();
    entry.title = 'title ' + i;
    const promise = conn.create_entry(entry);
    create_promises.push(promise);
  }
  await Promise.all(create_promises);
  const entries = await conn.get_entries('all', 0, 0);
  assert(entries.length === n);
  conn.close();
  await idb.remove(db_name);
}

export async function get_feed_ids_test() {
  const db_name = 'get-feed-ids-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new db.Feed();
    const url = new URL('a://b.c/feed' + i + '.xml');
    feed.appendURL(url);
    const promise = conn.create_feed(feed);
    create_promises.push(promise);
  }
  const created_feed_ids = await Promise.all(create_promises);
  const feed_ids = await conn.get_feed_ids();
  assert(feed_ids.length === created_feed_ids.length);
  for (const id of created_feed_ids) {
    assert(feed_ids.includes(id));
  }
  conn.close();
  await idb.remove(db_name);
}

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  const feed = new db.Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  const feed_id = await conn.create_feed(feed);
  assert(db.Feed.isValidId(feed_id));
  const stored_feed = await conn.get_feed('id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await conn.get_feed('url', url, false);
  assert(stored_feed2);
  conn.close();
  await idb.remove(db_name);
}

export async function get_feeds_test() {
  const db_name = 'get-feeds-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  const n = 5;           // number of feeds to store and test against
  let active_count = 0;  // track number of not-inactive
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new db.Feed();
    const url = new URL('a://b.c' + i);
    feed.appendURL(url);
    // make some inactive
    if (i % 2 === 0) {
      feed.active = false;
    } else {
      active_count++;
    }
    const promise = conn.create_feed(feed);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);
  const unsorted = await conn.get_feeds('all', false);
  assert(unsorted.length === n);
  for (const feed of unsorted) {
    assert(feed);
  }
  const sorted = await conn.get_feeds('all', true);
  assert(sorted.length === n);
  for (const feed of sorted) {
    assert(feed);
  }
  const actives = await conn.get_feeds('active', false);
  assert(actives.length === active_count);
  for (const feed of actives) {
    assert(feed);
    assert(feed.active);
  }
  conn.close();
  await idb.remove(db_name);
}

export async function iterate_entries_test() {
  const db_name = 'iterate-entries-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = new db.Entry();
    entry.title = 'test' + i;
    const promise = conn.create_entry(entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  let num_iterated = 0;
  await conn.iterate_entries(entry => {
    assert(entry);
    num_iterated++;
  });
  assert(num_iterated === n);
  conn.close();
  await idb.remove(db_name);
}

export async function mark_entry_read_test() {
  const db_name = 'mark-entry-read-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  const entry = new db.Entry();
  entry.readState = db.ENTRY_UNREAD;
  const id = await conn.create_entry(entry);
  let stored_entry = await conn.get_entry('id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === db.ENTRY_UNREAD);
  await conn.mark_entry_read(id);
  stored_entry = undefined;
  stored_entry = await conn.get_entry('id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === db.ENTRY_READ);
  conn.close();
  await idb.remove(db_name);
}

export async function query_entries_test() {
  const db_name = 'query-entries-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  const create_promises = [];
  let entry;

  // Create 5 unread entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new db.Entry();
    entry.readState = db.ENTRY_UNREAD;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = conn.create_entry(entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new db.Entry();
    entry.readState = db.ENTRY_READ;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = conn.create_entry(entry);
    create_promises.push(promise);
  }

  // Create 5 unread entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new db.Entry();
    entry.readState = db.ENTRY_UNREAD;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = conn.create_entry(entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new db.Entry();
    entry.readState = db.ENTRY_READ;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = conn.create_entry(entry);
    create_promises.push(promise);
  }

  // Wait until all creation is complete
  await Promise.all(create_promises);

  let entries;
  let query;

  // Query for all entries, assert that it finds the expected number of
  // entries. Also test an undefined query parameter here.
  entries = await conn.query_entries();
  assert(entries.length === 20);

  // Query for all unread entries, assert that it finds the expected number of
  // entries
  query = {read_state: db.ENTRY_UNREAD};
  entries = await conn.query_entries(query);
  assert(entries.length === 10);

  // Query for all read entries, assert that it finds the expected number of
  // entries
  query = {read_state: db.ENTRY_READ};
  entries = await conn.query_entries(query);
  assert(entries.length === 10);

  // Query using reverse direction. Assert that entries are returned in the
  // expected order.
  query = {direction: 'DESC'};
  entries = await conn.query_entries(query);
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
  entries = await conn.query_entries(query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an offset one less than the max
  query = {offset: 19};
  entries = await conn.query_entries(query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an arbitrary offset
  query = {offset: 11};
  entries = await conn.query_entries(query);
  assert(entries.length === 20 - query.offset);

  // Query using a limit greater than the number of existing entries
  query = {offset: 50000};
  entries = await conn.query_entries(query);
  assert(entries.length === 0);

  // Query using a limit without an offset
  query = {limit: 10};
  entries = await conn.query_entries(query);
  assert(entries.length <= 10);

  // Query using the smallest limit
  query = {limit: 1};
  entries = await conn.query_entries(query);
  assert(entries.length <= 1);

  // Query using offset and the smallest limit
  query = {offset: 10, limit: 1};
  entries = await conn.query_entries(query);
  assert(entries.length <= 1);

  // Query using limit greater than number of entries
  query = {limit: 9001};
  entries = await conn.query_entries(query);
  assert(entries.length === 20);

  // Query using an arbitrary offset and an arbitrary limit
  query = {offset: 5, limit: 8};
  entries = await conn.query_entries(query);
  assert(entries.length === 8);

  // Query using feed1
  query = {feed_id: 1};
  entries = await conn.query_entries(query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 1);
  }

  // Query using feed2
  query = {feed_id: 2};
  entries = await conn.query_entries(query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 2);
  }

  // Query using particular feed unread only
  query = {feed_id: 1, read_state: db.ENTRY_UNREAD};
  entries = await conn.query_entries(query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_UNREAD);
  }

  // Feed 1 read only
  query = {feed_id: 1, read_state: db.ENTRY_READ};
  entries = await conn.query_entries(query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_READ);
  }

  // Feed 1, unread, offset 3
  query = {feed_id: 1, read_state: db.ENTRY_UNREAD, offset: 3};
  entries = await conn.query_entries(query);
  assert(entries.length === 2);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_UNREAD);
  }

  conn.close();
  await idb.remove(db_name);
}

export async function update_entry_test() {
  const db_name = 'update-entry-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();

  let entry = new db.Entry();
  entry.title = 'first-title';
  const entry_id = await conn.create_entry(entry);
  entry = await conn.get_entry('id', entry_id, false);
  entry.title = 'second-title';
  await conn.update_entry(entry);
  entry = await conn.get_entry('id', entry_id, false);
  assert(entry.title === 'second-title');
  conn.close();
  await idb.remove(db_name);
}

export async function update_feed_test() {
  const db_name = 'update-feed-test';
  await idb.remove(db_name);
  const conn = new db.Db();
  conn.name = db_name;
  await conn.open();
  let feed = new db.Feed();
  feed.title = 'first';
  const url = new URL('a://b.c');
  feed.appendURL(url);
  let new_id = await conn.create_feed(feed);
  feed.id = new_id;
  feed.title = 'second';
  await conn.update_feed(feed, true);
  feed = undefined;  // paranoia
  feed = await conn.get_feed('id', new_id, false);
  assert(feed.title = 'second');
  conn.close();
  await idb.remove(db_name);
}

export async function sanitize_entry_content_test() {
  const entry = new db.Entry();
  let content = 'hello world';
  entry.content = content;

  const conn = new db.Db();

  conn.sanitize_entry(entry);
  assert(entry.content === content);

  // Test that line breaks are not filtered from content. This was previously
  // the source of a bug, where filter_controls was used in place of
  // filter_unprintables, where filter_controls matches \n and such, but
  // filter_unprintables does not
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  conn.sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(entry.content === expected, entry.content);
}
