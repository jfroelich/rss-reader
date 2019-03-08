import {assert} from '/src/assert.js';
import {INDEFINITE} from '/src/deadline/deadline.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Entry, is_entry} from '/src/model/entry.js';
import {Feed, is_feed} from '/src/model/feed.js';
import {Model} from '/src/model/model.js';

export async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  await model.archiveEntries(100);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function count_unread_entries_by_feed_test() {
  const db_name = 'count-unread-entries-by-feed-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed = new Feed();
  const url = new URL('http://www.example.com/feed.xml');
  feed.appendURL(url);
  const feed_id = await model.createFeed(feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state = i === 0 ? Entry.UNREAD : Entry.READ;
    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = new Entry();
      entry.feed = feed_id;
      entry.readState = read_state;
      const promise = model.createEntry(entry);
      create_promises.push(promise);
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await model.countUnreadEntriesByFeed(feed_id);
  assert(unread_count === num_entries_created_per_type);

  const non_existent_id = 123456789;
  unread_count = await model.countUnreadEntriesByFeed(non_existent_id);
  assert(unread_count === 0);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  let count = await model.countUnreadEntries();
  assert(0 === count);

  // Generate some unread entries
  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.appendURL(new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  // Generate some read entries
  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = new Entry();
    entry.readState = Entry.READ;
    entry.appendURL(new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  // Store both the read and unread entries
  const insert_promises = [];
  for (const entry of entries_to_insert) {
    insert_promises.push(model.createEntry(entry));
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await model.countUnreadEntries();
  assert(count === insert_unread_count);

  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_entry_test() {
  const db_name = 'create-entry-test';
  const model = new Model();
  model.name = db_name;
  await model.open();

  const entry = new Entry();
  const id = await model.createEntry(entry);
  const stored_entry = await model.getEntry('id', id, false);
  assert(stored_entry);
  assert(is_entry(stored_entry));
  assert(stored_entry.id === id);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_feed_test() {
  const db_name = 'create-feed-test';
  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed = new Feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  feed.appendURL(feed_url);
  const stored_feed_id = await model.createFeed(feed);
  assert(Feed.isValidId(stored_feed_id));
  let stored_feed = await model.getFeed('url', feed_url, true);
  assert(is_feed(stored_feed));
  stored_feed = await model.getFeed('id', stored_feed_id, false);
  assert(is_feed(stored_feed));
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_feed_url_constraint_test() {
  const db_name = 'create-feed-url-constraint-test';
  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed1 = new Feed();
  feed1.appendURL(new URL('http://www.example.com/example.rss'));
  const feed2 = new Feed();
  feed2.appendURL(new URL('http://www.example.com/example.rss'));

  await model.createFeed(feed1);
  let create_error;
  try {
    await model.createFeed(feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails as expected
  assert(create_error instanceof DOMException);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function create_feeds_test() {
  const db_name = 'create-feeds-test';

  const model = new Model();
  model.name = db_name;
  await model.open();

  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = new Feed();
    feed.appendURL(new URL('a://b.c' + i));
    feeds.push(feed);
  }
  const ids = await model.createFeeds(feeds);
  assert(ids.length === num_feeds);
  const stored_feeds = await model.getFeeds('all', false);
  assert(stored_feeds.length === num_feeds);
  const get_proms = ids.map(id => model.getFeed('id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(is_feed(feed));
    assert(Feed.isValidId(feed.id));
  }
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const entry1 = new Entry();
  const url1 = new URL('https://www.example1.com');
  entry1.appendURL(url1);

  const entry2 = new Entry();
  const url2 = new URL('https://www.example2.com');
  entry2.appendURL(url2);

  const entry_id1 = await model.createEntry(entry1);
  const entry_id2 = await model.createEntry(entry2);
  let stored_entry = await model.getEntry('id', entry_id1, false);
  assert(stored_entry);
  await model.deleteEntry(entry_id1, 'test');
  stored_entry = undefined;
  stored_entry = await model.getEntry('id', entry_id1, false);
  assert(!stored_entry);
  stored_entry = undefined;
  stored_entry = await model.getEntry('id', entry_id2, false);
  assert(stored_entry);
  model.close();
  await indexeddb_utils.remove(db_name);
}

// TODO: resolve conflict with delete_feed_test2
export async function delete_feed_test() {
  const db_name = 'delete-feed-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await model.createFeed(feed1);

  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  model.channel = channel;

  const delete_reason = 'test-reason';
  await model.deleteFeed(feed_id1, delete_reason);

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);

  model.close();
  await indexeddb_utils.remove(db_name);
}

// TODO: resolve conflict with delete_feed_test
export async function delete_feed_test2() {
  const db_name = 'delete-feed-test2';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed1 = new Feed();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed1.appendURL(url1);
  const feed_id1 = await model.createFeed(feed1);
  const feed2 = new Feed();
  const url2 = new URL('http://www.example.com/bar.xml');
  feed2.appendURL(url2);
  const feed_id2 = await model.createFeed(feed2);
  await model.deleteFeed(feed_id1);
  const stored_feed1 = await model.getFeed('id', feed_id1, false);
  assert(!stored_feed1);
  const stored_feed2 = await model.getFeed('id', feed_id2, false);
  assert(stored_feed2);
  const non_existent_id = 123456789;
  await model.deleteFeed(non_existent_id);
  await model.deleteFeed(feed_id2);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const entry = new Entry();
  entry.title = 'test';
  const entry_id = await model.createEntry(entry);
  const stored_entry = await model.getEntry('id', entry_id, false);
  assert(stored_entry);
  const non_existent_id = 123456789;
  const bad_entry = await model.getEntry('id', non_existent_id, false);
  assert(bad_entry === undefined);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function get_entries_test() {
  const db_name = 'get-entries-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = new Entry();
    entry.title = 'title ' + i;
    const promise = model.createEntry(entry);
    create_promises.push(promise);
  }
  await Promise.all(create_promises);
  const entries = await model.getEntries('all', 0, 0);
  assert(entries.length === n);
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function get_feed_ids_test() {
  const db_name = 'get-feed-ids-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new Feed();
    const url = new URL('a://b.c/feed' + i + '.xml');
    feed.appendURL(url);
    const promise = model.createFeed(feed);
    create_promises.push(promise);
  }
  const created_feed_ids = await Promise.all(create_promises);
  const feed_ids = await model.getFeedIds();
  assert(feed_ids.length === created_feed_ids.length);
  for (const id of created_feed_ids) {
    assert(feed_ids.includes(id));
  }
  model.close();
  await indexeddb_utils.remove(db_name);
}

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const feed = new Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  const feed_id = await model.createFeed(feed);
  assert(Feed.isValidId(feed_id));
  const stored_feed = await model.getFeed('id', feed_id, false);
  assert(stored_feed);
  const stored_feed2 = await model.getFeed('url', url, false);
  assert(stored_feed2);
  model.close();
  await indexeddb_utils.remove(db_name);
}

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
    const promise = model.createFeed(feed);
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
    const promise = model.createEntry(entry);
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
  const id = await model.createEntry(entry);
  let stored_entry = await model.getEntry('id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.UNREAD);
  await model.setEntryReadState(id, true);
  stored_entry = undefined;
  stored_entry = await model.getEntry('id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.READ);

  // Now mark it again as unread, and assert
  await model.setEntryReadState(id, false);
  stored_entry = undefined;
  stored_entry = await model.getEntry('id', id, false);
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
    const promise = model.createEntry(entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.READ;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = model.createEntry(entry);
    create_promises.push(promise);
  }

  // Create 5 unread entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = model.createEntry(entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = new Entry();
    entry.readState = Entry.READ;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = model.createEntry(entry);
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
  const entry_id = await model.createEntry(entry);
  entry = await model.getEntry('id', entry_id, false);
  entry.title = 'second-title';
  await model.updateEntry(entry);
  entry = await model.getEntry('id', entry_id, false);
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
  let new_id = await model.createFeed(feed);
  feed.id = new_id;
  feed.title = 'second';
  await model.updateFeed(feed, true);
  feed = undefined;  // paranoia
  feed = await model.getFeed('id', new_id, false);
  assert(feed.title = 'second');
  model.close();
  await indexeddb_utils.remove(db_name);
}
