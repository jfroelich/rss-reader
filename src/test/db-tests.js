import assert from '/src/assert.js';
import * as db from '/src/db.js';
import * as idb from '/src/idb.js';

export async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const max_age = 100;
  const ids = await db.archive_entries(conn, max_age);
  conn.close();
  await idb.remove(db_name);
}

export async function count_unread_entries_by_feed_test() {
  const db_name = 'count-unread-entries-by-feed-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);

  const feed = db.construct_feed();
  const url = new URL('http://www.example.com/feed.xml');
  db.append_feed_url(feed, url);
  const feed_id = await db.create_feed(conn, feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state = i === 0 ? db.ENTRY_UNREAD : db.ENTRY_READ;
    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = db.construct_entry();
      entry.feed = feed_id;
      entry.readState = read_state;
      const promise = db.create_entry(conn, entry);
      create_promises.push(promise);
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await db.count_unread_entries_by_feed(conn, feed_id);
  assert(unread_count === num_entries_created_per_type);

  const bad_id = 123456789;
  unread_count = await db.count_unread_entries_by_feed(conn, bad_id);
  assert(unread_count === 0);
  conn.close();
  await idb.remove(db_name);
}

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  const conn = await db.open(db_name);

  // Assert that the count of an empty database is in fact 0
  let count = await db.count_unread_entries(conn);
  assert(count === 0);

  // Generate some unread entries
  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = db.construct_entry();
    entry.readState = db.ENTRY_UNREAD;
    db.append_entry_url(entry, new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  // Generate some read entries
  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = db.construct_entry();
    entry.readState = db.ENTRY_READ;
    db.append_entry_url(entry, new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  // Store both the read and unread entries
  const insert_promises = [];
  for (const entry of entries_to_insert) {
    const promise = db.create_entry(conn, entry);
    insert_promises.push(promise);
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await db.count_unread_entries(conn);
  assert(count === insert_unread_count);

  conn.close();
  await idb.remove(db_name);
}

export async function create_entry_test() {
  const db_name = 'create-entry-test';
  const conn = await db.open(db_name);
  const entry = db.construct_entry();
  const id = await db.create_entry(conn, entry);
  const stored_entry = await db.get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(db.is_entry(stored_entry));
  assert(stored_entry.id === id);
  conn.close();
  await idb.remove(db_name);
}

export async function create_feed_test() {
  const db_name = 'create-feed-test';
  const conn = await db.open(db_name);
  const feed = db.construct_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  db.append_feed_url(feed, feed_url);
  const stored_feed_id = await db.create_feed(conn, feed);
  assert(db.is_valid_feed_id(stored_feed_id));
  let stored_feed = await db.get_feed(conn, 'url', feed_url, true);
  assert(db.is_feed(stored_feed));
  stored_feed = await db.get_feed(conn, 'id', stored_feed_id, false);
  assert(db.is_feed(stored_feed));
  conn.close();
  await idb.remove(db_name);
}

export async function create_feed_url_constraint_test() {
  const db_name = 'create-feed-url-constraint-test';
  const conn = await db.open(db_name);
  const feed1 = db.construct_feed();
  db.append_feed_url(feed1, new URL('http://www.example.com/example.rss'));
  const feed2 = db.construct_feed();
  db.append_feed_url(feed2, new URL('http://www.example.com/example.rss'));

  await db.create_feed(conn, feed1);
  let create_error;
  try {
    await db.create_feed(conn, feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails. The error message will look
  // like this: "Unable to add key to index 'urls': at least one key does not
  // satisfy the uniqueness requirements." We use instanceof to at least rule
  // out other error types like TypeError or InvalidStateError (thrown by
  // channel.postMessage) or AssertionError. indexedDB throws DOMExceptions
  // specifically. I'd rather not rely on the actual words of the error message
  // and unfortunately indexedDB conflates all of its error types into a single
  // generic error type so just assume any error of that type is good enough.
  assert(create_error instanceof DOMException);
  conn.close();
  await idb.remove(db_name);
}

export async function create_feeds_test() {
  const db_name = 'create-feeds-test';
  const conn = await db.open(db_name);
  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = db.construct_feed();
    db.append_feed_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }
  const ids = await db.create_feeds(conn, feeds);
  assert(ids.length === num_feeds);
  const stored_feeds = await db.get_feeds(conn, 'all', false);
  assert(stored_feeds.length === num_feeds);
  const get_proms = ids.map(id => db.get_feed(conn, 'id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(db.is_feed(feed));
    assert(db.is_valid_feed_id(feed.id));
  }
  conn.close();
  await idb.remove(db_name);
}

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const entry1 = db.construct_entry();
  const url1 = new URL('https://www.example1.com');
  db.append_entry_url(entry1, url1);
  const entry2 = db.construct_entry();
  const url2 = new URL('https://www.example2.com');
  db.append_entry_url(entry2, url2);
  const entry_id1 = await db.create_entry(conn, entry1);
  const entry_id2 = await db.create_entry(conn, entry2);
  let stored_entry = await db.get_entry(conn, 'id', entry_id1, false);
  assert(stored_entry);
  await db.delete_entry(conn, entry_id1, 'test');
  stored_entry = undefined;
  stored_entry = await db.get_entry(conn, 'id', entry_id1, false);
  assert(!stored_entry);
  stored_entry = undefined;
  stored_entry = await db.get_entry(conn, 'id', entry_id2, false);
  assert(stored_entry);
  conn.close();
  await idb.remove(db_name);
}

export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const feed1 = db.construct_feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  db.append_feed_url(feed1, url1);
  const feed_id1 = await db.create_feed(conn, feed1);
  const feed2 = db.construct_feed();
  const url2 = new URL('http://www.example.com/bar.xml');
  db.append_feed_url(feed2, url2);
  const feed_id2 = await db.create_feed(conn, feed2);
  await db.delete_feed(conn, feed_id1);
  const stored_feed1 = await db.get_feed(conn, 'id', feed_id1, false);
  assert(!stored_feed1);
  const stored_feed2 = await db.get_feed(conn, 'id', feed_id2, false);
  assert(stored_feed2);
  const bad_id = 123456789;
  await db.delete_feed(conn, bad_id);
  await db.delete_feed(conn, feed_id2);
  conn.close();
  await idb.remove(db_name);
}

export async function is_entry_test() {
  const correct = db.construct_entry();
  assert(db.is_entry(correct));
  assert(!db.is_feed(correct));
  const nomagic = {};
  assert(!db.is_entry(nomagic));
}

export async function append_entry_url_test() {
  const entry = db.construct_entry();
  assert(entry.urls === undefined || entry.urls.length === 0);
  db.append_entry_url(entry, new URL('a://b.c1'));
  assert(entry.urls);
  assert(entry.urls.length === 1);
  const url2 = new URL('a://b.c2');
  let appended = db.append_entry_url(entry, url2);
  assert(entry.urls.length === 2);
  assert(appended === true);
  appended = false;
  appended = db.append_entry_url(entry, url2);
  assert(entry.urls.length === 2);
  assert(appended === false);
  assert(db.is_entry(entry));
}

export async function is_feed_test() {
  const fcorrect = db.construct_feed();
  assert(db.is_feed(fcorrect));
  assert(!db.is_entry(fcorrect));
  const nomagic = {};
  assert(!db.is_feed(nomagic));
}

export async function append_feed_url_test() {
  const feed = db.construct_feed();
  assert(!db.feed_has_url(feed)); // precondition
  db.append_feed_url(feed, new URL('a://b.c1')); // insert first
  assert(db.feed_has_url(feed)); // expect change
  const url2 = new URL('a://b.c2');
  db.append_feed_url(feed, url2); // insert second
  assert(feed.urls.length === 2); // expect increment
  db.append_feed_url(feed, url2); // insert duplicate
  assert(feed.urls.length === 2); // expect no change
  assert(db.is_feed(feed)); // modifications preserved type
}

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const entry = db.construct_entry();
  entry.title = 'test';
  const entry_id = await db.create_entry(conn, entry);
  const stored_entry = await db.get_entry(conn, 'id', entry_id, false);
  assert(stored_entry);
  const bad_id = 123456789;
  const bad_entry = await db.get_entry(conn, 'id', bad_id, false);
  assert(bad_entry === undefined);
  conn.close();
  await idb.remove(db_name);
}

export async function get_entries_test() {
  const db_name = 'get-entries-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = db.construct_entry();
    entry.title = 'title ' + i;
    const promise = db.create_entry(conn, entry);
    create_promises.push(promise);
  }
  await Promise.all(create_promises);
  const entries = await db.get_entries(conn, 'all', 0, 0);
  assert(entries.length === n);
  conn.close();
  await idb.remove(db_name);
}

export async function get_feed_ids_test() {
  const db_name = 'get-feed-ids-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = db.construct_feed();
    const url = new URL('a://b.c/feed' + i + '.xml');
    db.append_feed_url(feed, url);
    const promise = db.create_feed(conn, feed);
    create_promises.push(promise);
  }
  const created_feed_ids = await Promise.all(create_promises);
  const feed_ids = await db.get_feed_ids(conn);
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
  const conn = await db.open(db_name);
  const feed = db.construct_feed();
  const url = new URL('a://b.c');
  db.append_feed_url(feed, url);
  const feed_id = await db.create_feed(conn, feed);
  assert(db.is_valid_feed_id(feed_id));
  const stored_feed = await db.get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await db.get_feed(conn, 'url', url, false);
  assert(stored_feed2);
  conn.close();
  await idb.remove(db_name);
}


export async function get_feeds_test() {
  const db_name = 'get-feeds-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  const n = 5;           // number of feeds to store and test against
  let active_count = 0;  // track number of not-inactive
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = db.construct_feed();
    const url = new URL('a://b.c' + i);
    db.append_feed_url(feed, url);
    // make some inactive
    if (i % 2 === 0) {
      feed.active = false;
    } else {
      active_count++;
    }
    const promise = db.create_feed(conn, feed);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);
  const unsorted = await db.get_feeds(conn, 'all', false);
  assert(unsorted.length === n);
  for (const feed of unsorted) {
    assert(feed);
  }
  const sorted = await db.get_feeds(conn, 'all', true);
  assert(sorted.length === n);
  for (const feed of sorted) {
    assert(feed);
  }
  const actives = await db.get_feeds(conn, 'active', false);
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
  const conn = await db.open(db_name);

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = db.construct_entry();
    entry.title = 'test' + i;
    const promise = db.create_entry(conn, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  let num_iterated = 0;
  await db.iterate_entries(conn, entry => {
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
  const conn = await db.open(db_name);
  const entry = db.construct_entry();
  entry.readState = db.ENTRY_UNREAD;
  const id = await db.create_entry(conn, entry);
  let stored_entry = await db.get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === db.ENTRY_UNREAD);
  await db.mark_entry_read(conn, id);
  stored_entry = undefined;
  stored_entry = await db.get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === db.ENTRY_READ);
  conn.close();
  await idb.remove(db_name);
}

export async function query_entries_test() {
  const db_name = 'query-entries-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);

  const create_promises = [];
  let entry;

  // Create 5 unread entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = db.construct_entry();
    entry.readState = db.ENTRY_UNREAD;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = db.create_entry(conn, entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = db.construct_entry();
    entry.readState = db.ENTRY_READ;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = db.create_entry(conn, entry);
    create_promises.push(promise);
  }

  // Create 5 unread entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = db.construct_entry();
    entry.readState = db.ENTRY_UNREAD;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = db.create_entry(conn, entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = db.construct_entry();
    entry.readState = db.ENTRY_READ;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = db.create_entry(conn, entry);
    create_promises.push(promise);
  }

  // Wait until all creation is complete
  await Promise.all(create_promises);

  let entries;
  let query;

  // Query for all entries, assert that it finds the expected number of
  // entries. Also test an undefined query parameter here.
  entries = await db.query_entries(conn);
  assert(entries.length === 20);

  // Query for all unread entries, assert that it finds the expected number of
  // entries
  query = {read_state: db.ENTRY_UNREAD};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 10);

  // Query for all read entries, assert that it finds the expected number of
  // entries
  query = {read_state: db.ENTRY_READ};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 10);

  // Query using reverse direction. Assert that entries are returned in the
  // expected order.
  query = {direction: 'DESC'};
  entries = await db.query_entries(conn, query);
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
  entries = await db.query_entries(conn, query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an offset one less than the max
  query = {offset: 19};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an arbitrary offset
  query = {offset: 11};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 20 - query.offset);

  // Query using a limit greater than the number of existing entries
  query = {offset: 50000};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 0);

  // Query using a limit without an offset
  query = {limit: 10};
  entries = await db.query_entries(conn, query);
  assert(entries.length <= 10);

  // Query using the smallest limit
  query = {limit: 1};
  entries = await db.query_entries(conn, query);
  assert(entries.length <= 1);

  // Query using offset and the smallest limit
  query = {offset: 10, limit: 1};
  entries = await db.query_entries(conn, query);
  assert(entries.length <= 1);

  // Query using limit greater than number of entries
  query = {limit: 9001};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 20);

  // Query using an arbitrary offset and an arbitrary limit
  query = {offset: 5, limit: 8};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 8);

  // Query using feed1
  query = {feed_id: 1};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 1);
  }

  // Query using feed2
  query = {feed_id: 2};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 2);
  }

  // Query using particular feed unread only
  query = {feed_id: 1, read_state: db.ENTRY_UNREAD};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_UNREAD);
  }

  // Feed 1 read only
  query = {feed_id: 1, read_state: db.ENTRY_READ};
  entries = await db.query_entries(conn, query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_READ);
  }

  // Feed 1, unread, offset 3
  query = {feed_id: 1, read_state: db.ENTRY_UNREAD, offset: 3};
  entries = await db.query_entries(conn, query);
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
  const conn = await db.open(db_name);
  let entry = db.construct_entry();
  entry.title = 'first-title';
  const entry_id = await db.create_entry(conn, entry);
  entry = await db.get_entry(conn, 'id', entry_id, false);
  entry.title = 'second-title';
  await db.update_entry(conn, entry);
  entry = await db.get_entry(conn, 'id', entry_id, false);
  assert(entry.title === 'second-title');
  conn.close();
  await idb.remove(db_name);
}

export async function update_feed_test() {
  const db_name = 'update-feed-test';
  await idb.remove(db_name);
  const conn = await db.open(db_name);
  let feed = db.construct_feed();
  feed.title = 'first';
  const url = new URL('a://b.c');
  db.append_feed_url(feed, url);
  let new_id = await db.create_feed(conn, feed);
  feed.id = new_id;
  feed.title = 'second';
  await db.update_feed(conn, feed, true);
  feed = undefined;  // paranoia
  feed = await db.get_feed(conn, 'id', new_id, false);
  assert(feed.title = 'second');
  conn.close();
  await idb.remove(db_name);
}

export async function sanitize_entry_content_test() {
  const entry = db.construct_entry();
  let content = 'hello world';
  entry.content = content;
  db.sanitize_entry(entry);
  assert(entry.content === content);

  // Test that line breaks are not filtered from content. This was previously
  // the source of a bug, where filter_controls was used in place of
  // filter_unprintables, where filter_controls matches \n and such, but
  // filter_unprintables does not
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  db.sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(entry.content === expected, entry.content);
}
