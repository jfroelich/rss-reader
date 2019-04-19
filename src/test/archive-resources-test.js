import * as databaseUtils from '/src/test/database-utils.js';
import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import * as rss from '/src/service/resource-storage-service.js';
import TestRegistry from '/src/test/test-registry.js';
import archiveResources from '/src/service/archive-resources.js';
import assert from '/src/lib/assert.js';

// Exercise typical execution of archive-entries
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
    createPromises.push(rss.createEntry(conn, resource));
  }

  const ids = await Promise.all(createPromises);

  // pseudo advance clock so that all entries expire, we have to do it this way because we cannot
  // exercise control over resource.created_date, createEntry auto sets it
  await new Promise(resolve => setTimeout(resolve, 50));

  // Combined with the fake advance just prior, at least one millis will have elapsed so we
  // know that each resource created-date check will be considered expired
  const maxAge = 1;

  // Intentionally choose a size smaller than num archivable to enter the repeated read case
  // 2 goes into 5 2.5 times, so we will get 3 iterations
  const batchSize = 2;

  await archiveResources(conn, batchSize, maxAge);

  const resources = await rss.getEntries(conn, { mode: 'all' });
  assert(resources.length === 5);

  for (const resource of resources) {
    assert(ids.includes(resource.id));
    assert(resource.archived === 1);
    assert(resource.content === undefined);
    assert(resource.archived_date instanceof Date);
  }

  // TODO: test running a second time and verifying nothing happens because all archivable
  // resources were archived

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(archiveResourcesTest);
