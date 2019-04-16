import * as databaseUtils from '/src/test/database-utils.js';
import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import TestRegistry from '/src/test/test-registry.js';
import archiveResources from '/src/service/archive-resources.js';
import assert from '/src/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResources from '/src/db/get-resources.js';

// Exercise typical execution of archive-resources
async function archiveResourcesTest() {
  const databaseNamePrefix = 'archive-resources-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  const createPromises = [];
  for (let i = 0; i < 5; i += 1) {
    const resource = {
      title: `title ${i}`, content: 'foo', read: 1, type: 'entry'
    };
    createPromises.push(createResource(conn, resource));
  }

  const ids = await Promise.all(createPromises);

  // pseudo advance clock so that entries expire
  await new Promise(resolve => setTimeout(resolve, 50));
  const maxAge = 1;
  await archiveResources(conn, maxAge);

  const resources = await getResources(conn, { mode: 'all' });
  assert(resources.length === 5);

  for (const resource of resources) {
    assert(ids.includes(resource.id));
    assert(resource.archived === 1);
    assert(resource.content === undefined);
    assert(resource.archived_date instanceof Date);
  }

  // TODO: test running a second time and verifying nothing happens

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(archiveResourcesTest);
