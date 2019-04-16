import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';

async function getResourceTest() {
  const databaseNamePrefix = 'get-resource-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  const resource = { type: 'entry', title: 'test' };
  const id = await createResource(conn, resource);
  const match = await getResource(conn, { mode: 'id', id });
  assert(match);
  assert(match.id === id);
  assert(match.type === 'entry');
  assert(match.title === 'test');

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(getResourceTest);
