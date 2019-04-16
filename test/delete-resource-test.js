import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import deleteResource from '/src/db/delete-resource.js';
import getResource from '/src/db/get-resource.js';

async function deleteResourceTest() {
  const databaseNamePrefix = 'delete-resource-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  const feed = { type: 'feed', urls: ['a://b.c'] };
  const feedId = await createResource(conn, feed);
  const entry = { type: 'entry', parent: feedId };
  await createResource(conn, entry);

  await deleteResource(conn, feedId, 'test');

  const match = await getResource(conn, { mode: 'id', id: feedId });
  assert(!match);

  assert(conn.channel.messages.length);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(deleteResourceTest);
