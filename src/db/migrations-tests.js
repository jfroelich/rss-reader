import * as migrations from '/src/db/migrations.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import RecordingChannel from '/src/lib/recording-channel.js';

export async function migrations_tests_20() {
  let database_name = 'migrations-test-20-database';
  await indexeddb_utils.remove(database_name);

  const channel = new RecordingChannel('migrations-test-20-channel');
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

// TODO: test creating database (old version 0) to 21. open to 20, insert an
// entry without magic, close, open to 21, verify that 21 added the magic prop
// to the test entry
