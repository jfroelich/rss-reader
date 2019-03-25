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

  await indexeddb_utils.remove(conn.name);
}

// Test upgrading to 20, inserting an entry, upgrading to 21, and then verify
// that an entry inserted in 20 was modified after upgrading to 21, and that the
// migration to 21 dispatched a message to the channel.
export async function migrations_tests_20_21() {
  const database_name = 'migrations-tests-20-21';
  await indexeddb_utils.remove(database_name);

  const handler =
      event => {
        migrations.migrate20(event, channel);
        migrations.migrate21(event, channel);
      }

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
  await indexeddb_utils.remove(conn.name);
}
