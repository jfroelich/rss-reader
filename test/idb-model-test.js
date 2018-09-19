import * as idbmodel from '/src/idb-model.js';
import assert from '/src/assert/assert.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import * as Model from '/src/model.js';
import {register_test} from '/test/test-registry.js';

async function activate_feed_test() {
  const feed = Model.create_feed();
  feed.active = false;
  Model.append_feed_url(feed, new URL('a://b.c'));

  const conn = await idbmodel.open('activate-feed-test');
  const id = await idbmodel.create_feed(conn, feed);
  await idbmodel.activate_feed(conn, id);
  const stored_feed = await idbmodel.get_feed(conn, 'id', id);

  assert(Model.is_feed(stored_feed));
  assert(stored_feed.active === true);
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);

  // Activating a feed that is already active should fail
  let activation_error;
  try {
    await idbmodel.activate_feed(conn, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  conn.close();
  await indexeddb.remove(conn.name);
}

async function archive_entries_test() {
  // TODO: insert archivable data, non-archivable data, and then assert the
  // archivable data was archived, and that the non-archivable data was not
  // archived
  const conn = await idbmodel.open('archive-entries-test');
  const max_age = 100;
  const ids = await idbmodel.archive_entries(conn, max_age);
  conn.close();
  await indexeddb.remove(conn.name);
}

async function create_entry_test() {
  const conn = await idbmodel.open('create-entry-test');
  const entry = Model.create_entry();
  const id = await idbmodel.create_entry(conn, entry);
  const stored_entry = await idbmodel.get_entry(conn, 'id', id);

  assert(stored_entry);
  assert(Model.is_entry(stored_entry));
  assert(stored_entry.id === id);

  conn.close();
  await indexeddb.remove(conn.name);
}

async function create_feed_test() {
  const feed = Model.create_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  Model.append_feed_url(feed, feed_url);
  const conn = await idbmodel.open('create-feed-test');
  const stored_feed_id = await idbmodel.create_feed(conn, feed);
  assert(Model.is_valid_feed_id(stored_feed_id));
  let stored_feed = await idbmodel.get_feed(conn, 'url', feed_url, true);
  assert(Model.is_feed(stored_feed));
  stored_feed = await idbmodel.get_feed(conn, 'id', stored_feed_id, false);
  assert(Model.is_feed(stored_feed));
  conn.close();
  await indexeddb.remove(conn.name);
}

// Test that double url insert fails, it is expected to throw a
// DOMException like the following: "Unable to add key to index 'urls': at least
// one key does not satisfy the uniqueness requirements."
async function create_feed_url_constraint_test() {
  const conn = await idbmodel.open('create-feed-url-constraint-test');
  const feed1 = Model.create_feed();
  Model.append_feed_url(feed1, new URL('http://www.example.com/example.rss'));
  await idbmodel.create_feed(conn, feed1);

  const feed2 = Model.create_feed();
  Model.append_feed_url(feed2, new URL('http://www.example.com/example.rss'));

  let create_error;
  try {
    await idbmodel.create_feed(conn, feed2);
  } catch (error) {
    create_error = error;
  }
  assert(create_error instanceof DOMException);

  conn.close();
  await indexeddb.remove(conn.name);
}

async function create_feeds_test() {
  const conn = await idbmodel.open('create-feeds-test');

  const num_feeds = 3;
  const feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = Model.create_feed();
    Model.append_feed_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }

  const ids = await idbmodel.create_feeds(conn, feeds);
  assert(ids.length === num_feeds, '' + ids);

  const stored_feeds = await idbmodel.get_feeds(conn, 'all');
  assert(stored_feeds.length === num_feeds);

  // Exercise the id check
  const get_proms = ids.map(id => idbmodel.get_feed(conn, 'id', id));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(Model.is_feed(feed));
    assert(Model.is_valid_feed_id(feed.id));
  }

  conn.close();
  await indexeddb.remove(conn.name);
}

async function count_unread_entries_test() {
  const conn = await idbmodel.open('count-unread-entries-test');
  let count = await idbmodel.count_unread_entries(conn);
  assert(count === 0);

  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = Model.create_entry();
    entry.readState = Model.ENTRY_STATE_UNREAD;
    Model.append_entry_url(entry, new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = Model.create_entry();
    entry.readState = Model.ENTRY_STATE_READ;
    Model.append_entry_url(entry, new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  const insert_promises = [];
  for (const entry of entries_to_insert) {
    const promise = idbmodel.create_entry(conn, entry);
    insert_promises.push(promise);
  }
  await Promise.all(insert_promises);

  count = await idbmodel.count_unread_entries(conn);
  assert(count === insert_unread_count);

  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(activate_feed_test);
register_test(archive_entries_test);
register_test(create_entry_test);
register_test(create_feed_test);
register_test(create_feed_url_constraint_test);
register_test(create_feeds_test);
register_test(count_unread_entries_test);
