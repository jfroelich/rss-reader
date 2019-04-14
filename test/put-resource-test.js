import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import putResource from '/src/db/put-resource.js';

export default async function putResourceTest() {
  const databaseNamePrefix = 'put-resource-test';
  await databaseUtils.removeDatbasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  const fakeParentResourceId = 1;
  const id = await createResource(conn, {
    title: 'first', type: 'entry', parent: fakeParentResourceId
  });
  let resource = await getResource({ conn, mode: 'id', id });
  assert(resource);
  assert(resource.title === 'first');

  resource.title = 'second';
  await putResource(conn, resource);
  resource = await getResource({ conn, mode: 'id', id });
  assert(resource);
  assert(resource.title === 'second');

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
