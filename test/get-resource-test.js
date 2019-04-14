import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';

export default async function getResourceTest() {
  const databaseNamePrefix = 'get-resource-test';
  await databaseUtils.removeDatbasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  const resource = { type: 'entry', title: 'test' };
  const id = await createResource(conn, resource);

  const match = await getResource({ conn, mode: 'id', id });
  assert(match);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
