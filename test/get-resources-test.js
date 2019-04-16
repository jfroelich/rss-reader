import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResources from '/src/db/get-resources.js';

async function getResourcesTest() {
  const databaseNamePrefix = 'get-resources-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  const createPromises = [];
  for (let i = 0; i < 5; i += 1) {
    createPromises.push(createResource(conn, { title: `test${i}`, type: 'entry' }));
  }
  await Promise.all(createPromises);

  const resources = await getResources(conn, { mode: 'all' });
  assert(resources.length === 5);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(getResourcesTest);
