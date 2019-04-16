import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import * as migrations from '/src/db/migrations.js';
import RecordingChannel from '/src/test/recording-channel.js';
import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';

// TODO: this should access migrations via db, not violate the API surface
async function migrationsTests20() {
  const databaseName = 'migrations-test-20-database';
  await indexedDBUtils.remove(databaseName);

  const channel = new RecordingChannel();
  const version = 20;
  let timeout;

  const handler = (event) => {
    migrations.migrate20(event, channel);
  };

  const conn = await indexedDBUtils.open(databaseName, version, handler, timeout);

  // The specified version is expected to be the actual version
  assert(conn.version === version);

  // The database should now have a feed store (these throw uncaught exceptions
  // if that is not the case)
  const transaction = conn.transaction('feed');
  const feedStore = transaction.objectStore('feed');

  // The key path should be id, and it should be auto-incremented
  assert(feedStore.autoIncrement);
  assert(feedStore.keyPath === 'id');

  // The feed store should have a urls index
  assert(feedStore.indexNames.contains('urls'));

  conn.close();

  await indexedDBUtils.remove(databaseName);
}

// Verify that migrating to 23 drops the title index on the feed store
async function migrationsTests23() {
  const databaseName = 'migrations-tests-23';
  await indexedDBUtils.remove(databaseName);

  const handler = (event) => {
    migrations.migrate20(event);
    migrations.migrate21(event);
    migrations.migrate22(event);
    migrations.migrate23(event);
  };

  // It should not contain title index initially, because the index is no longer
  // created, because the migration function was modified
  let conn = await indexedDBUtils.open(databaseName, 20, handler);
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
  conn = await indexedDBUtils.open(databaseName, 23, handler);
  transaction = conn.transaction('feed');
  store = transaction.objectStore('feed');
  assert(!store.indexNames.contains('title'));
  transaction.abort();
  conn.close();

  await indexedDBUtils.remove(databaseName);
}

async function migrationsTests30() {
  const databaseName = 'migrations-tests-30';
  await indexedDBUtils.remove(databaseName);

  let channel;

  const handler = (event) => {
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

  const conn = await indexedDBUtils.open(databaseName, 29, handler);

  // insert a test feed
  await new Promise((resolve, reject) => {
    let id;
    const transaction = conn.transaction('feed', 'readwrite');
    transaction.oncomplete = () => resolve(id);
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('feed');
    const request = store.put({ title: 'test feed created in version 29' });
    request.onsuccess = () => {
      id = request.result;
    };
  });

  // insert a test entry
  await new Promise((resolve, reject) => {
    let id;
    const transaction = conn.transaction('entry', 'readwrite');
    transaction.oncomplete = () => resolve(id);
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('entry');
    const request = store.put({ title: 'test entry created in version 29' });
    request.onsuccess = () => {
      id = request.result;
    };
  });

  conn.close();

  const conn30 = await indexedDBUtils.open(databaseName, 30, handler);

  // TODO: confirm the feed and entry were copied over

  conn30.close();
  await indexedDBUtils.remove(conn30.name);
}

async function migrationsTests31() {
  const databaseName = 'migrations-tests-31';
  await indexedDBUtils.remove(databaseName);

  const handler = (event) => {
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

  let conn = await indexedDBUtils.open(databaseName, 30, handler);

  // insert a test feed with a property we expect to be modified
  await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onerror = event => reject(event.target.error);
    const store = transaction.objectStore('feeds');
    store.put({ dateUpdated: new Date() });
  });

  conn.close();

  conn = await indexedDBUtils.open(databaseName, 31, handler);

  // Verify the entry store has some of the appropriate indices (we can infer
  // that if a few worked the rest worked). Create a temporary transaction and
  // cancel it later.
  const transaction = conn.transaction('entries');
  const entryStore = transaction.objectStore('entries');
  assert(entryStore.indexNames.contains('feed-read_state-date_published'));
  assert(entryStore.indexNames.contains('read_state-date_published'));
  assert(entryStore.indexNames.contains('read_state'));
  transaction.abort();

  // Read back the feed that underwent migration. We only inserted 1 so we
  // cheat and just grab feed with id 1
  const modifiedFeed = await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds');
    const store = transaction.objectStore('feeds');
    const request = store.get(1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  conn.close();

  // Verify the new state is as expected
  assert(modifiedFeed);
  assert(modifiedFeed.date_updated);
  assert(!modifiedFeed.dateUpdated);

  await indexedDBUtils.remove(databaseName);
}

async function migrationsTests32() {
  const databaseName = 'migrations-tests-32';
  await indexedDBUtils.remove(databaseName);

  const handler = (event) => {
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

  let conn = await indexedDBUtils.open(databaseName, 31, handler);

  const dateUpdated = new Date();

  // insert a test feed with a property we expect to be modified
  await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onerror = event => reject(event.target.error);
    const store = transaction.objectStore('feeds');
    store.put({ date_updated: dateUpdated });
  });

  conn.close();

  conn = await indexedDBUtils.open(databaseName, 32, handler);

  // Verify the entry store has some of the appropriate indices (we can infer
  // that if a few worked the rest worked). Create a temporary transaction and
  // cancel it later.
  const transaction = conn.transaction('entries');
  const entryStore = transaction.objectStore('entries');
  assert(!entryStore.indexNames.contains('feed-date_published'));
  assert(entryStore.indexNames.contains('feed-published-date'));
  transaction.abort();

  const modifiedFeed = await new Promise((resolve, reject) => {
    const transaction = conn.transaction('feeds');
    const store = transaction.objectStore('feeds');
    const request = store.get(1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  conn.close();

  // Verify the new state is as expected
  assert(modifiedFeed);
  assert(!modifiedFeed.date_updated);
  assert(modifiedFeed.updated_date);

  await indexedDBUtils.remove(databaseName);
}

async function migrationsTests33() {
  const databaseName = 'migrations-tests-33';
  await indexedDBUtils.remove(databaseName);

  const handler = (event) => {
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

  let conn = await indexedDBUtils.open(databaseName, 32, handler);

  let transaction = conn.transaction('entries');
  let entriesStore = transaction.objectStore('entries');
  let feedIndex = entriesStore.index('feed');
  transaction.abort();
  assert(feedIndex);

  conn.close();

  conn = await indexedDBUtils.open(databaseName, 33, handler);

  transaction = conn.transaction('entries');
  entriesStore = transaction.objectStore('entries');

  feedIndex = undefined;
  let expectedError;
  try {
    feedIndex = entriesStore.index('feed');
  } catch (error) {
    expectedError = error;
  }

  transaction.abort();

  // Attempting to reference the non-existent index should result in an error,
  // and the index should be undefined
  assert(!feedIndex);
  assert(expectedError instanceof DOMException);

  conn.close();
  await indexedDBUtils.remove(databaseName);
}

TestRegistry.registerTest(migrationsTests20);
TestRegistry.registerTest(migrationsTests23);
TestRegistry.registerTest(migrationsTests30);
TestRegistry.registerTest(migrationsTests31);
TestRegistry.registerTest(migrationsTests32);
TestRegistry.registerTest(migrationsTests33);
