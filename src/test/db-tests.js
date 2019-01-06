import assert from '/src/assert.js';
import * as db from '/src/db.js';
import * as idb from '/src/idb.js';

export async function activate_feed_test() {
  const db_name = 'activate-feed-test';

  // I am not using try/finally to ensure the database is removed at the end of
  // the test when an exception occurs. It leaves the database as existing,
  // which then causes ripple effect errors here when reusing the existing
  // database. So just delete the database if it exists first to avoid the
  // headache.
  await idb.remove(db_name);

  const session = await db.open(db_name);

  // Setup a fake channel for recording messages for later assertions. Do not
  // immediately attach it to the session because we want to ignore certain
  // calls that broadcast messages.
  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);

  // Create an inactive feed and store it
  const feed = db.create_feed_object();
  feed.active = false;
  db.append_feed_url(feed, new URL('a://b.c'));
  const id = await db.create_feed(session, feed);

  // Now attach the channel. We wait until now to skip over create-feed
  session.channel = channel;

  // Run the primary focus of this test. This should succeed without error. This
  // implies quite a lot, including that the feed object was found in the
  // database, that the object was of type feed, and that the feed was not
  // already in the active state.
  await db.activate_feed(session, id);

  // Detach the channel. Just rules out any chance of awkwardness with out of
  // order execution in this test.
  session.channel = undefined;

  // Activating a feed should have produced a single message of a certain type
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-updated');

  // Read the feed back out of the database to investigate
  const stored_feed = await db.db.get_feed(session, 'id', id, false);

  // Activation should not have somehow destroyed type info. For performance
  // reasons this check is NOT implicit in the db.get_feed call, so it is not
  // redundant or unreasonable to check here.
  assert(db.is_feed(stored_feed));

  // Activation should result in the active state
  assert(stored_feed.active === true);

  // Activation should have cleared out any dependent deactivation properties
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);

  // The feed should not have somehow been updated in the future
  const now = new Date();
  assert(stored_feed.dateUpdated <= now);

  // Assert that activating a feed that is already active should fail.
  let activation_error;
  try {
    await db.activate_feed(session, id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Activating a feed that does not exist should fail. There is some subtle
  // complexity here because we need to test against a feed identifier that at
  // minimum appears to be a real feed identifier. There are implicit checks for
  // invalid feed ids (e.g. anything less than 1), and we don't want to trigger
  // those errors, we want to trigger only the error that occurs as a result of
  // searching the object store and not finding something.
  const fictitious_feed_id = 123456789;
  activation_error = undefined;
  try {
    await db.activate_feed(session, fictitious_feed_id);
  } catch (error) {
    activation_error = error;
  }
  assert(activation_error);

  // Test teardown
  session.close();
  await idb.remove(db_name);
}

export async function archive_entries_test() {
  // At the moment this test is a nominal stub that does not actually test
  // anything
  // TODO: insert archivable data, non-archivable data, and then assert the
  // archivable data was archived, and that the non-archivable data was not
  // archived
  // TODO: assert channeled messages work
  const db_name = 'archive-entries-test';
  const session = await db.open(db_name);
  const max_age = 100;
  const ids = await db.archive_entries(session, max_age);
  session.close();
  await idb.remove(db_name);
}

export async function count_unread_entries_by_feed_test() {
  const db_name = 'count-unread-entries-by-feed-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const feed = db.create_feed_object();
  const url = new URL('http://www.example.com/feed.xml');
  db.append_feed_url(feed, url);
  const feed_id = await db.create_feed(session, feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state =
        i === 0 ? db.ENTRY_UNREAD : db.ENTRY_READ;

    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = db.create_entry_object();
      entry.feed = feed_id;
      entry.readState = read_state;
      const promise = db.create_entry(session, entry);
      create_promises.push(promise);
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await db.count_unread_entries_by_feed(session, feed_id);
  assert(unread_count === num_entries_created_per_type);

  const non_existing_feed_id = 123456789;
  unread_count =
      await db.count_unread_entries_by_feed(session, non_existing_feed_id);
  assert(unread_count === 0);

  session.close();
  await idb.remove(db_name);
}

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  const session = await db.open(db_name);

  // Assert that the count of an empty database is in fact 0
  let count = await db.count_unread_entries(session);
  assert(count === 0);

  // Generate some unread entries
  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = db.create_entry_object();
    entry.readState = db.ENTRY_UNREAD;
    db.append_entry_url(entry, new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  // Generate some read entries
  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = db.create_entry_object();
    entry.readState = db.ENTRY_READ;
    db.append_entry_url(entry, new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  // Store both the read and unread entries
  const insert_promises = [];
  for (const entry of entries_to_insert) {
    const promise = db.create_entry(session, entry);
    insert_promises.push(promise);
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await db.count_unread_entries(session);
  assert(count === insert_unread_count);

  session.close();
  await idb.remove(db_name);
}

export async function create_entry_test() {
  const db_name = 'create-entry-test';
  const session = await db.open(db_name);
  // Create and store an entry in the database. Grab its generated id.
  const entry = db.create_entry_object();
  const id = await db.create_entry(session, entry);
  // Load the entry from the database corresponding to the generated id and
  // verify the state of its properties
  const stored_entry = await db.get_entry(session, 'id', id, false);
  // We should have matched an object
  assert(stored_entry);
  // The object type should not be corrupted
  assert(db.is_entry(stored_entry));
  // The object ids should match
  assert(stored_entry.id === id);
  session.close();
  await idb.remove(db_name);
}

export async function create_feed_test() {
  // TODO: test the pathological use cases of create-feed
  // TODO: test that creating a feed with missing information fails, or creating
  // a feed with other bad format or something also fails, e.g. wrong object
  // type, missing url, using an explicit id property should fail, etc
  // TODO: test that searching by a different url does not somehow match it
  // TODO: test it works without channel
  // TODO: test it sends the right messages to channel
  // TODO: test it sends expected number of messages to channel
  // TODO: test that searching by a different id does not somehow match new feed
  const db_name = 'create-feed-test';
  const session = await db.open(db_name);

  // Create a dummy feed object, store it, grab its new id
  const feed = db.create_feed_object();
  const feed_url = new URL('http://www.example.com/example.rss');
  db.append_feed_url(feed, feed_url);
  const stored_feed_id = await db.create_feed(session, feed);

  // Verify the generated id looks valid
  assert(db.is_valid_feed_id(stored_feed_id));

  // Verify the feed is findable by url
  let stored_feed = await db.get_feed(session, 'url', feed_url, true);
  assert(db.is_feed(stored_feed));

  // Verify the feed is findable by id
  stored_feed = await db.get_feed(session, 'id', stored_feed_id, false);
  assert(db.is_feed(stored_feed));

  // Test teardown
  session.close();
  await idb.remove(db_name);
}

export async function create_feed_url_constraint_test() {
  // Test that uniqueness contraint on feed store url index causes create-feed to
  // fail as expected
  const db_name = 'create-feed-url-constraint-test';
  const session = await db.open(db_name);

  // TODO: reuse the same URL object here, do not create two url objects, it
  // just leaves db.open room for inconsistency and is less terse

  // Generate and store a basic feed
  const feed1 = db.create_feed_object();
  db.append_feed_url(
      feed1, new URL('http://www.example.com/example.rss'));
  await db.create_feed(session, feed1);

  // Generate and store a second feed with the same url
  const feed2 = db.create_feed_object();
  db.append_feed_url(
      feed2, new URL('http://www.example.com/example.rss'));

  // Call and trap the error. This should fail.
  let create_error;
  try {
    await db.create_feed(session, feed2);
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

  session.close();
  await idb.remove(db_name);
}

export async function create_feeds_test() {
  // TODO: test behavior when two or more feeds have identical urls
  const db_name = 'create-feeds-test';
  const session = await db.open(db_name);

  const num_feeds = 3, feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = db.create_feed_object();
    db.append_feed_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }

  const ids = await create_feeds(session, feeds);
  assert(ids.length === num_feeds);
  const stored_feeds = await db.get_feeds(session, 'all', false);
  assert(stored_feeds.length === num_feeds);

  const get_proms = ids.map(id => db.get_feed(session, 'id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(db.is_feed(feed));
    assert(db.is_valid_feed_id(feed.id));
  }

  session.close();
  await idb.remove(db_name);
}

export async function deactivate_feed_test() {
  // TODO: this test is minimal, to at least have the ordinary case exercised.
  // I need to test other cases and pathological cases.
  const db_name = 'deactivate-feed-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);
  const feed = db.create_feed_object();
  const url = new URL('a://b.c');
  db.append_feed_url(feed, url);
  feed.active = true;
  const feed_id = await db.create_feed(session, feed);
  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  function noop() {}
  channel.close = noop;
  session.channel = channel;
  await deactivate_feed(session, feed_id, 'testing');
  const stored_feed = await db.get_feed(session, 'id', feed_id, false);
  // Deactivating the feed should not somehow make it not findable by id
  assert(stored_feed);
  // Deactivating the feed should somehow not destroy type information
  assert(db.is_feed(stored_feed));
  // Deactivating the feed should result in the active property being the value
  // of false. Not just undefined, not just key deleted.
  assert(stored_feed.active === false);
  // Deactivating a feed should have resulted in storing a date
  assert(stored_feed.deactivateDate);
  // The deactivation date should never be in the future
  const now = new Date();
  assert(stored_feed.deactivateDate <= now);
  // Tear down
  session.close();
  await idb.remove(db_name);
}

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const entry = db.create_entry_object();
  const url = new URL('https://www.example.com');
  db.append_entry_url(entry, url);

  const entry2 = db.create_entry_object();
  const url2 = new URL('https://www.example2.com');
  db.append_entry_url(entry2, url2);

  const entry_id = await db.create_entry(session, entry);
  const entry_id2 = await db.create_entry(session, entry2);
  let stored_entry = await db.get_entry(session, 'id', entry_id, false);
  // Confirms the entry exists as a pre-condition
  assert(stored_entry);
  await db.delete_entry(session, entry_id, 'test');
  stored_entry = undefined;
  stored_entry = await db.get_entry(session, 'id', entry_id, false);
  assert(!stored_entry);
  stored_entry = undefined;
  stored_entry = await db.get_entry(session, 'id', entry_id2, false);
  // We should still be able to find the second entry after deleting the first
  assert(stored_entry);
  session.close();
  await idb.remove(db_name);
}

export async function delete_feed_test() {
  // TODO: test what happens when concurrently deleting feeds
  function noop() {}
  // TODO: need to test the effect of deleting a feed that also has entries.
  // there should be entry messages too, and also, entries should not be left
  // behind, the wrong entries should not be deleted, etc.

  const db_name = 'delete-feed-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  // Create and store a feed
  const feed1 = db.create_feed_object();
  const url1 = new URL('http://www.example.com/foo.xml');
  db.append_feed_url(feed1, url1);
  const feed_id1 = await db.create_feed(session, feed1);

  // Create and store a second feed
  const feed2 = db.create_feed_object();
  const url2 = new URL('http://www.example.com/bar.xml');
  db.append_feed_url(feed2, url2);
  const feed_id2 = await db.create_feed(session, feed2);

  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;
  session.channel = channel;
  const delete_reason = 'test';

  // Remove the first feed
  await db.delete_feed(session, feed_id1, delete_reason);

  // Paranoia
  session.channel = undefined;

  // feed1 should no longer exist in the database. I assume that trying to get
  // the feed by its id is enough of a test to confirm that.
  const stored_feed1 = await db.get_feed(session, 'id', feed_id1, false);
  assert(!stored_feed1);

  // removing feed1 should not have somehow affected feed2
  const stored_feed2 = await db.get_feed(session, 'id', feed_id2, false);
  assert(stored_feed2);

  // Test messaging. Because feed1 has no entries we only expect 1 message.
  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);

  // Remove a feed that does not exist. db.delete_feed should still work, it just
  // does nothing. Notably, db.delete_feed does not require the feed to exist, and
  // this is just confirming that contractual representation.
  // Do this before removing the other feed so that this is tested on a
  // non-empty object store, if that ever matters?
  const fictional_feed_id = 123456789;
  await db.delete_feed(session, fictional_feed_id, delete_reason);

  // Remove the second feed. This should occur without error. Removing the
  // second feed after having removed the first should not fail. Calling
  // db.delete_feed without a channel should not fail. Not providing a reason
  // should not cause an error.
  await db.delete_feed(session, feed_id2);

  // Test teardown
  session.close();
  await idb.remove(db_name);
}

export async function entry_utils_is_entry_test() {
  const correct = db.create_entry_object();
  assert(db.is_entry(correct));
  assert(!db.is_feed(correct));
  const nomagic = {};
  assert(!db.is_entry(nomagic));
}

export async function entry_utils_append_entry_url_test() {
  const entry = db.create_entry_object();
  // Check our precondition
  assert(entry.urls === undefined || entry.urls.length === 0);
  // Appending the first url should lazily init urls list and increment the
  // urls count
  db.append_entry_url(entry, new URL('a://b.c1'));
  assert(entry.urls);
  assert(entry.urls.length === 1);
  // Appending a distinct url should increase url count
  const url2 = new URL('a://b.c2');
  let appended = db.append_entry_url(entry, url2);
  assert(entry.urls.length === 2);
  assert(appended === true);
  // Reset, this guards against strange things like append_entry_url failing
  // to return
  appended = false;
  // Try to append a duplicate
  appended = db.append_entry_url(entry, url2);
  // Appending a duplicate url should not increase url count
  assert(entry.urls.length === 2);
  // The append should return false to indicate no append
  assert(appended === false);
  // After any number of appends, entry should still be an entry
  assert(db.is_entry(entry));
}

export async function feed_utils_is_feed_test() {
  const fcorrect = db.create_feed_object();
  assert(db.is_feed(fcorrect));
  assert(!db.is_entry(fcorrect));
  const nomagic = {};
  assert(!db.is_feed(nomagic));
}

export async function feed_utils_append_feed_url_test() {
  const feed = db.create_feed_object();
  // precondition, in case create_feed_object changes its behavior
  assert(feed.urls === undefined || feed.urls.length === 0);
  // Appending the first url should lazily init urls list and increment the
  // urls count
  db.append_feed_url(feed, new URL('a://b.c1'));
  assert(feed.urls);
  assert(feed.urls.length === 1);
  // Appending a distinct url should increase url count
  const url2 = new URL('a://b.c2');
  db.append_feed_url(feed, url2);
  assert(feed.urls.length === 2);
  // Appending a duplicate url should not increase url count
  db.append_feed_url(feed, url2);
  assert(feed.urls.length === 2);
  // After appends, feed should still be a feed
  assert(db.is_feed(feed));
}

export async function get_entries_test() {
  const db_name = 'get-entries-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);
  // Number of entries for testing. This should be greater than one
  // because some later logic may assume that at least one entry exists.
  const n = 5;
  // Insert n entries
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = db.create_entry_object();
    entry.title = 'title ' + i;
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }
  await Promise.all(create_promises);

  // Get all entries in the database
  const entries = await db.get_entries(session, 'all', 0, 0);
  // We should have loaded n many entries
  assert(entries.length === n);
  // Test teardown
  session.close();
  await idb.remove(db_name);
}

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);
  const entry = db.create_entry_object();
  entry.title = 'test';
  const entry_id = await db.create_entry(session, entry);
  const stored_entry = await db.get_entry(session, 'id', entry_id, false);
  assert(stored_entry);

  const bad_id = 123456789;
  const bad_entry = await db.get_entry(session, 'id', bad_id, false);
  assert(bad_entry === undefined);
  session.close();
  await idb.remove(db_name);
}

export async function get_feed_ids_test() {
  const db_name = 'get-feed-ids-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const n = 5;

  // Create some feeds
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = db.create_feed_object();
    const url = new URL('http://www.example.com/feed' + i + '.xml');
    db.append_feed_url(feed, url);
    const promise = db.create_feed(session, feed);
    create_promises.push(promise);
  }
  const created_feed_ids = await Promise.all(create_promises);
  const feed_ids = await db.get_feed_ids(session);
  assert(feed_ids.length === created_feed_ids.length);

  for (const id of created_feed_ids) {
    assert(feed_ids.includes(id));
  }

  session.close();
  await idb.remove(db_name);
}

export async function get_feed_test() {
  const db_name = 'get-feed-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const feed = db.create_feed_object();
  const url = new URL('a://b.c');
  db.append_feed_url(feed, url);
  const feed_id = await db.create_feed(session, feed);

  // Precon
  assert(db.is_valid_feed_id(feed_id));

  const stored_feed = await db.get_feed(session, 'id', feed_id, false);
  assert(stored_feed);

  const stored_feed2 = await db.get_feed(session, 'url', url, false);
  assert(stored_feed2);
  session.close();
  await idb.remove(db_name);
}

export async function get_feeds_test() {
  // TODO: inline these again, not enough value
  function get_all_feeds_unsorted(session) {
    return db.get_feeds(session, 'all', false);
  }

  function get_all_feeds_sorted(session) {
    return db.get_feeds(session, 'all', true);
  }

  function get_active_feeds(session) {
    return db.get_feeds(session, 'active', false);
  }

  const db_name = 'get-feeds-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const n = 5;           // number of feeds to store and test against
  let active_count = 0;  // track number of not-inactive
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = db.create_feed_object();
    const url = new URL('a://b.c' + i);
    db.append_feed_url(feed, url);

    // make some inactive
    if (i % 2 === 0) {
      feed.active = false;
    } else {
      active_count++;
    }

    const promise = db.create_feed(session, feed);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  const all_unsorted_feeds = await get_all_feeds_unsorted(session);
  assert(all_unsorted_feeds.length === n);
  for (const feed of all_unsorted_feeds) {
    assert(feed);
  }

  const all_sorted_feeds = await get_all_feeds_sorted(session);
  assert(all_sorted_feeds.length === n);
  for (const feed of all_sorted_feeds) {
    assert(feed);
  }

  const active_feeds = await get_active_feeds(session);
  assert(active_feeds.length === active_count);
  for (const feed of active_feeds) {
    assert(feed);
    assert(feed.active);
  }

  session.close();
  await idb.remove(db_name);
}

export async function iterate_entries_test() {
  const db_name = 'iterate-entries-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = db.create_entry_object();
    entry.title = 'test' + i;
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  let num_iterated = 0;
  await db.iterate_entries(session, entry => {
    assert(entry);
    num_iterated++;
  });
  assert(num_iterated === n);
  session.close();
  await idb.remove(db_name);
}

export async function mark_entry_read_test() {
  function noop() {}
  const db_name = 'mark-entry-read-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);
  const entry = db.create_entry_object();
  entry.readState = db.ENTRY_UNREAD;
  const id = await db.create_entry(session, entry);
  let stored_entry = await db.get_entry(session, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === db.ENTRY_UNREAD);

  const messages = [];
  const channel = {};
  channel.name = 'mark-entry-read-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;
  await db.mark_entry_read(session, id);
  session.channel = undefined;

  stored_entry = undefined;
  stored_entry = await db.get_entry(session, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === db.ENTRY_READ);

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(first_message.type === 'entry-read');
  assert(first_message.id === id);

  session.close();
  await idb.remove(db_name);
}

export async function query_entries_test() {
  const db_name = 'query-entries-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const create_promises = [];
  let entry;

  // Create 5 unread entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = db.create_entry_object();
    entry.readState = db.ENTRY_UNREAD;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 1
  for (let i = 0; i < 5; i++) {
    entry = db.create_entry_object();
    entry.readState = db.ENTRY_READ;
    entry.feed = 1;
    entry.datePublished = new Date();
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }

  // Create 5 unread entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = db.create_entry_object();
    entry.readState = db.ENTRY_UNREAD;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }

  // Create 5 read entries tied to feed 2
  for (let i = 0; i < 5; i++) {
    entry = db.create_entry_object();
    entry.readState = db.ENTRY_READ;
    entry.feed = 2;
    entry.datePublished = new Date();
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }

  // Wait until all creation is complete
  await Promise.all(create_promises);

  let entries;
  let query;

  // Query for all entries, assert that it finds the expected number of
  // entries. Also test an undefined query parameter here.
  entries = await query_entries(session);
  assert(entries.length === 20);

  // Query for all unread entries, assert that it finds the expected number of
  // entries
  query = {read_state: db.ENTRY_UNREAD};
  entries = await query_entries(session, query);
  assert(entries.length === 10);

  // Query for all read entries, assert that it finds the expected number of
  // entries
  query = {read_state: db.ENTRY_READ};
  entries = await query_entries(session, query);
  assert(entries.length === 10);

  // Query using reverse direction. Assert that entries are returned in the
  // expected order.
  query = {direction: 'DESC'};
  entries = await query_entries(session, query);
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
  entries = await query_entries(session, query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an offset one less than the max
  query = {offset: 19};
  entries = await query_entries(session, query);
  assert(entries.length === 20 - query.offset);

  // Query using no limit and an arbitrary offset
  query = {offset: 11};
  entries = await query_entries(session, query);
  assert(entries.length === 20 - query.offset);

  // Query using a limit greater than the number of existing entries
  query = {offset: 50000};
  entries = await query_entries(session, query);
  assert(entries.length === 0);

  // Query using a limit without an offset
  query = {limit: 10};
  entries = await query_entries(session, query);
  assert(entries.length <= 10);

  // Query using the smallest limit
  query = {limit: 1};
  entries = await query_entries(session, query);
  assert(entries.length <= 1);

  // Query using offset and the smallest limit
  query = {offset: 10, limit: 1};
  entries = await query_entries(session, query);
  assert(entries.length <= 1);

  // Query using limit greater than number of entries
  query = {limit: 9001};
  entries = await query_entries(session, query);
  assert(entries.length === 20);

  // Query using an arbitrary offset and an arbitrary limit
  query = {offset: 5, limit: 8};
  entries = await query_entries(session, query);
  assert(entries.length === 8);

  // Query using feed1
  query = {feed_id: 1};
  entries = await query_entries(session, query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 1);
  }

  // Query using feed2
  query = {feed_id: 2};
  entries = await query_entries(session, query);
  assert(entries.length === 10);
  for (const entry of entries) {
    assert(entry.feed === 2);
  }

  // Query using particular feed unread only
  query = {feed_id: 1, read_state: db.ENTRY_UNREAD};
  entries = await query_entries(session, query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_UNREAD);
  }

  // Feed 1 read only
  query = {feed_id: 1, read_state: db.ENTRY_READ};
  entries = await query_entries(session, query);
  assert(entries.length === 5);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_READ);
  }

  // Feed 1, unread, offset 3
  query = {feed_id: 1, read_state: db.ENTRY_UNREAD, offset: 3};
  entries = await query_entries(session, query);
  assert(entries.length === 2);
  for (const entry of entries) {
    assert(entry.feed === 1);
    assert(entry.readState === db.ENTRY_UNREAD);
  }

  // Test teardown
  session.close();
  await idb.remove(db_name);
}


export async function remove_lost_entries_test() {

  function noop() {}
  const db_name = 'idb.remove-lost-entries-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const n = 10;
  let num_lost = 0;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = db.create_entry_object();
    entry.title = 'title' + i;

    if (i % 3 === 0) {
      num_lost++;
    } else {
      const url = new URL('a://b.c' + i);
      db.append_entry_url(entry, url);
    }

    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }
  const created_ids = await Promise.all(create_promises);

  const messages = [];
  const channel = {};
  channel.name = 'idb.remove-lost-entries-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;

  const removed_ids = await remove_lost_entries(session);

  assert(removed_ids.length === num_lost);

  assert(messages.length === num_lost);
  for (const message of messages) {
    assert(message.type === 'entry-deleted');
    assert(db.is_valid_entry_id(message.id));
  }

  const remaining_entries = await db.get_entries(session, 'all', 0, 0);
  assert(remaining_entries.length === (created_ids.length - num_lost));

  session.close();
  await idb.remove(db_name);
}


export async function remove_orphaned_entries_test() {

  function count_entries(session) {
    return new Promise((resolve, reject) => {
      const tx = session.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const request = store.count();
      request.onsuccess = _ => resolve(request.result);
      request.onerror = _ => reject(request.error);
    });
  }

  function noop() {}

  const db_name = 'idb.remove-orphaned-entries-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  // TODO: create some entries not linked to any feeds, and then run idb.remove
  // orphans, and then assert entries removed

  const n = 10;

  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = db.create_entry_object();
    entry.title = 'title' + i;
    const promise = db.create_entry(session, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  const messages = [];
  const channel = {};
  channel.name = 'idb.remove-orphaned-entries-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  const pre_op_count = await count_entries(session);
  assert(pre_op_count !== 0);

  session.channel = channel;
  await remove_orphaned_entries(session);
  session.channel = undefined;

  // All entries should have been removed because none are linked to a feed
  const post_op_count = await count_entries(session);
  assert(post_op_count === 0);

  assert(messages.length > 0);

  session.close();
  await idb.remove(db_name);
}


export async function sanitize_entry_content_test() {
  // TODO: validate truncation behavior?

  . Create a reusable entry object for input to sub tests.
  const entry = db.create_entry_object();

  // Test the simple ordinary usage. Here no sanitization needs to take place,
  // so test that the value is not somehow clobbered, returns a string.
  let content = 'hello world';
  entry.content = content;
  sanity.sanitize_entry(entry);
  assert(entry.content === content);

  // Test that line breaks are not filtered from content. This was previously
  // the source of a bug, where filter_controls was used in place of
  // filter_unprintables, where filter_controls matches \n and such, but
  // filter_unprintables does not
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  sanity.sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(entry.content === expected, entry.content);
}


export async function update_entry_test() {

  function noop() {}

  const db_name = 'update-entry-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);


  let entry = db.create_entry_object();
  entry.title = 'first-title';
  const entry_id = await db.create_entry(session, entry);

  const messages = [];
  const channel = {};
  channel.name = 'update-entry-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;

  entry = await db.get_entry(session, 'id', entry_id, false);
  entry.title = 'second-title';
  await update_entry(session, entry);

  session.channel = undefined;

  entry = await db.get_entry(session, 'id', entry_id, false);
  assert(entry.title === 'second-title');

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(first_message.type === 'entry-updated');
  assert(first_message.id === entry_id);

  session.close();
  await idb.remove(db_name);
}


export async function update_feed_test() {


  function noop() {}

  const db_name = 'update-feed-test';
  await idb.remove(db_name);
  const session = await db.open(db_name);

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  let feed = db.create_feed_object();
  feed.title = 'first';
  const url = new URL('a://b.c');
  db.append_feed_url(feed, url);
  let new_id = await db.create_feed(session, feed);
  feed.id = new_id;

  session.channel = channel;

  // Update the feed's title property
  feed.title = 'second';
  await update_feed(session, feed, true);

  session.channel = undefined;
  feed = undefined;  // paranoia
  feed = await db.get_feed(session, 'id', new_id, false);

  // The title should be updated to the new title
  assert(feed.title = 'second');

  // Check messages
  assert(messages.length === 1);
  const message = messages[0];
  assert(message.type === 'feed-updated');
  assert(message.id === feed.id);

  // Test teardown
  session.close();
  await idb.remove(db_name);
}
