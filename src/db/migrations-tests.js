import * as migrations from '/src/db/migrations.js';
import * as types from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import RecordingChannel from '/src/lib/recording-channel.js';

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

// Test upgrading to 20, inserting an entry, upgrading to 21, and then verify
// that an entry inserted in 20 was modified after upgrading to 21, and that the
// migration to 21 dispatched a message to the channel.
export async function migrations_tests_20_21() {
  const database_name = 'migrations-tests-20-21';
  await indexeddb_utils.remove(database_name);

  const handler = event => {
    migrations.migrate20(event, channel);
    migrations.migrate21(event, channel);
  };

  // Step 1: create a database in version 20
  const channel = new RecordingChannel();
  channel.name = 'migrations-tests-20-21';
  let conn = await indexeddb_utils.open(database_name, 20, handler);

  // Step 2: insert a test entry that is missing magic props
  let id = await new Promise((resolve, reject) => {
    let id = undefined;
    const transaction = conn.transaction('entry', 'readwrite');
    transaction.oncomplete = event => resolve(id);
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('entry');
    const request = store.put({title: 'test entry created in version 20'});
    request.onsuccess = event => id = request.result;
  });

  // close the connection to 20
  conn.close();

  // Step 3: connect to 21
  conn = await indexeddb_utils.open(database_name, 21, handler);

  // Step 4: verify that entry now has magic prop
  let has_magic = await new Promise((resolve, reject) => {
    const transaction = conn.transaction('entry');
    const store = transaction.objectStore('entry');
    const request = store.get(id);
    request.onerror = event => reject(request.error);
    request.onsuccess = event => resolve(types.is_entry(request.result));
  });

  // (explicit to also verify resolve value is boolean)
  assert(has_magic === true);

  // Step 5: verify that the 20 to 21 migration produced a message
  assert(channel.messages.length);
  assert(channel.messages[0].type === 'entry-updated');
  assert(channel.messages[0].id === id);

  conn.close();
  await indexeddb_utils.remove(database_name);
}

// Verify that when upgrading from 20 to 22 a feed is properly modified
export async function migrations_tests_22() {
  const database_name = 'migrations-tests-22';
  await indexeddb_utils.remove(database_name);

  const handler = event => {
    migrations.migrate20(event, channel);
    migrations.migrate21(event, channel);
    migrations.migrate22(event, channel);
  };

  const channel = new RecordingChannel();
  channel.name = 'migrations-tests-22';
  let conn = await indexeddb_utils.open(database_name, 20, handler);

  let id = await new Promise((resolve, reject) => {
    let id = undefined;
    const transaction = conn.transaction('feed', 'readwrite');
    transaction.oncomplete = event => resolve(id);
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('feed');
    const request = store.put({title: 'test feed created in version 20'});
    request.onsuccess = event => id = request.result;
  });

  conn.close();
  conn = await indexeddb_utils.open(database_name, 22, handler);

  let has_magic = await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.get(id);
    request.onerror = event => reject(request.error);
    request.onsuccess = event => resolve(types.is_feed(request.result));
  });

  assert(has_magic === true);
  assert(channel.messages[0].type === 'feed-updated');
  assert(channel.messages[0].id === id);

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
