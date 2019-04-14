import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import assert from '/lib/assert.js';
import countResources from '/src/db/count-resources.js';
import createResource from '/src/db/create-resource.js';

export default async function countResourcesTest() {
  const databaseNamePrefix = 'count-resources-test';
  await databaseUtils.removeDatbasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  // Verify counting nothing is 0
  let count = await countResources({ conn, read: 0, type: 'entry' });
  assert(count === 0);

  const createPromises = [];
  for (let i = 0; i < 8; i += 1) {
    const resource = { read: (i > 2 ? 1 : 0), title: `test ${i}`, type: 'entry' };
    createPromises.push(createResource(conn, resource));
  }
  await Promise.all(createPromises);

  count = await countResources({ conn, read: 0, type: 'entry' });
  assert(count === 3);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
