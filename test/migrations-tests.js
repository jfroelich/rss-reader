import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import * as migrations from '/src/db/migrations.js';
import RecordingChannel from '/test/recording-channel.js';

export async function migrations_tests_20() {
  let database_name = 'migrations-test-20-database';
  await indexeddb_utils.remove(database_name);

  const channel = new RecordingChannel();
  let version = 20;
  let timeout = undefined;

  const handler = event => {
    migrations.migrate20(event, channel);
  };

  const conn =
      await indexeddb_utils.open(database_name, version, handler, timeout);

  // The specified version is expected to be the actual version
  assert(conn.version === version);

  // The database should now have a feed store (these throw uncaught exceptions
  // if that is not the case)
  const transaction = conn.transaction('feed');
  const feed_store = transaction.objectStore('feed');

  // The key path should be id, and it should be auto-incremented
  assert(feed_store.autoIncrement);
  assert(feed_store.keyPath === 'id');

  // The feed store should have a urls index
  assert(feed_store.indexNames.contains('urls'));

  conn.close();

  await indexeddb_utils.remove(database_name);
}

// Verify that migrating to 23 drops the title index on the feed store
export async function migrations_tests_23() {
  const database_name = 'migrations-tests-23';
  await indexeddb_utils.remove(database_name);

  const handler = event => {
    migrations.migrate20(event);
    migrations.migrate21(event);
    migrations.migrate22(event);
    migrations.migrate23(event);
  };

  // It should not contain title index initially, because the index is no longer
  // created, because the migration function was modified
  let conn = await indexeddb_utils.open(database_name, 20, handler);
  let transaction = conn.transaction('feed');
  let store = transaction.objectStore('feed');
  assert(!store.indexNames.contains('title'));
  transaction.abort();
  conn.close();

  // It should no longer contain it (and it should not produce an error). Note
  // that this test exposed a bug that was since fixed. The migration to 23
  // assumed that the index exists, and called deleteIndex naively, which then
  // produced an error about unable to delete non-existent index. Now the 23
  // migration checks for the presence of the index. Therefore, this test is
  // not only testing that the index is gone, it is also just exercising the
  // migration and testing that it runs without error.
  conn = await indexeddb_utils.open(database_name, 23, handler);
  transaction = conn.transaction('feed');
  store = transaction.objectStore('feed');
  assert(!store.indexNames.contains('title'));
  transaction.abort();
  conn.close();

  await indexeddb_utils.remove(database_name);
}

export async function migrations_tests_30() {
  const database_name = 'migrations-tests-30';
  await indexeddb_utils.remove(database_name);

  let channel;

  const handler = event => {
    migrations.migrate20(event, channel);
    migrations.migrate21(event, channel);
    migrations.migrate22(event, channel);
    migrations.migrate23(event, channel);
    migrations.migrate24(event, channel);
    migrations.migrate25(event, channel);
    migrations.migrate26(event, channel);
    migrations.migrate27(event, channel);
    migrations.migrate28(event, channel);
    migrations.migrate29(event, channel);
    migrations.migrate30(event, channel);
  };

  let conn = await indexeddb_utils.open(database_name, 29, handler);

  // insert a test feed
  let id = await new Promise((resolve, reject) => {
    let id = undefined;
    const transaction = conn.transaction('feed', 'readwrite');
    transaction.oncomplete = event => resolve(id);
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('feed');
    const request = store.put({title: 'test feed created in version 29'});
    request.onsuccess = event => id = request.result;
  });

  // insert a test entry
  id = await new Promise((resolve, reject) => {
    let id = undefined;
    const transaction = conn.transaction('entry', 'readwrite');
    transaction.oncomplete = event => resolve(id);
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('entry');
    const request = store.put({title: 'test entry created in version 29'});
    request.onsuccess = event => id = request.result;
  });

  conn.close();

  let conn30 = await indexeddb_utils.open(database_name, 30, handler);

  // TODO: confirm the feed and entry were copied over

  conn30.close();
  await indexeddb_utils.remove(conn30.name);
}

export async function migrations_tests_31() {
  const database_name = 'migrations-tests-31';
  await indexeddb_utils.remove(database_name);

  const handler = event => {
    migrations.migrate20(event);
    migrations.migrate21(event);
    migrations.migrate22(event);
    migrations.migrate23(event);
    migrations.migrate24(event);
    migrations.migrate25(event);
    migrations.migrate26(event);
    migrations.migrate27(event);
    migrations.migrate28(event);
    migrations.migrate29(event);
    migrations.migrate30(event);
    migrations.migrate31(event);
  };

  let conn = await indexeddb_utils.open(database_name, 30, handler);

  // insert a test feed with a property we expect to be modified
  await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onerror = event => reject(event.target.error);
    const store = transaction.objectStore('feeds');
    const request = store.put({dateUpdated: new Date()});
  });

  conn.close();

  conn = await indexeddb_utils.open(database_name, 31, handler);

  // Verify the entry store has some of the appropriate indices (we can infer
  // that if a few worked the rest worked). Create a temporary transaction and
  // cancel it later.
  const transaction = conn.transaction('entries');
  const entry_store = transaction.objectStore('entries');
  assert(entry_store.indexNames.contains('feed-read_state-date_published'));
  assert(entry_store.indexNames.contains('read_state-date_published'));
  assert(entry_store.indexNames.contains('read_state'));
  transaction.abort();

  // Read back the feed that underwent migration. We only inserted 1 so we
  // cheat and just grab feed with id 1
  let modified_feed = await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds');
    const store = transaction.objectStore('feeds');
    const request = store.get(1);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });

  conn.close();

  // Verify the new state is as expected
  assert(modified_feed);
  assert(modified_feed.date_updated);
  assert(!modified_feed.dateUpdated);

  await indexeddb_utils.remove(database_name);
}

export async function migrations_tests_32() {
  const database_name = 'migrations-tests-32';
  await indexeddb_utils.remove(database_name);

  const handler = event => {
    migrations.migrate20(event);
    migrations.migrate21(event);
    migrations.migrate22(event);
    migrations.migrate23(event);
    migrations.migrate24(event);
    migrations.migrate25(event);
    migrations.migrate26(event);
    migrations.migrate27(event);
    migrations.migrate28(event);
    migrations.migrate29(event);
    migrations.migrate30(event);
    migrations.migrate31(event);
    migrations.migrate32(event);
  };

  let conn = await indexeddb_utils.open(database_name, 31, handler);

  const date_updated = new Date();

  // insert a test feed with a property we expect to be modified
  await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onerror = event => reject(event.target.error);
    const store = transaction.objectStore('feeds');
    const request = store.put({date_updated: date_updated});
  });

  conn.close();

  conn = await indexeddb_utils.open(database_name, 32, handler);

  // Verify the entry store has some of the appropriate indices (we can infer
  // that if a few worked the rest worked). Create a temporary transaction and
  // cancel it later.
  const transaction = conn.transaction('entries');
  const entry_store = transaction.objectStore('entries');
  assert(!entry_store.indexNames.contains('feed-date_published'));
  assert(entry_store.indexNames.contains('feed-published-date'));
  transaction.abort();

  let modified_feed = await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds');
    const store = transaction.objectStore('feeds');
    const request = store.get(1);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });

  conn.close();

  // Verify the new state is as expected
  assert(modified_feed);
  assert(!modified_feed.date_updated);
  assert(modified_feed.updated_date);

  await indexeddb_utils.remove(database_name);
}

export async function migrations_tests_33() {
  const database_name = 'migrations-tests-33';
  await indexeddb_utils.remove(database_name);

  const handler = event => {
    migrations.migrate20(event);
    migrations.migrate21(event);
    migrations.migrate22(event);
    migrations.migrate23(event);
    migrations.migrate24(event);
    migrations.migrate25(event);
    migrations.migrate26(event);
    migrations.migrate27(event);
    migrations.migrate28(event);
    migrations.migrate29(event);
    migrations.migrate30(event);
    migrations.migrate31(event);
    migrations.migrate32(event);
    migrations.migrate33(event);
  };

  let conn = await indexeddb_utils.open(database_name, 32, handler);

  let transaction = conn.transaction('entries');
  let entries_store = transaction.objectStore('entries');
  let feed_index = entries_store.index('feed');
  transaction.abort();
  assert(feed_index);

  conn.close();

  conn = await indexeddb_utils.open(database_name, 33, handler);

  transaction = conn.transaction('entries');
  entries_store = transaction.objectStore('entries');

  feed_index = undefined;
  let expected_error;
  try {
    feed_index = entries_store.index('feed');
  } catch (error) {
    expected_error = error;
  }

  transaction.abort();

  // Attempting to reference the non-existent index should result in an error,
  // and the index should be undefined
  assert(!feed_index);
  assert(expected_error instanceof DOMException);

  conn.close();
  await indexeddb_utils.remove(database_name);
}
