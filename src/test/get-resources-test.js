import * as databaseUtils from '/src/test/database-utils.js';
import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResources from '/src/db/get-resources.js';

async function getResourcesTest() {
  const databaseNamePrefix = 'get-resources-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  const createPromises = [];
  for (let i = 0; i < 5; i += 1) {
    const title = `test${i}`;
    const type = 'entry';
    createPromises.push(createResource(conn, { title, type }));
  }
  await Promise.all(createPromises);

  const mode = 'all';
  const resources = await getResources(conn, { mode });
  assert(resources.length === 5);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(getResourcesTest);
