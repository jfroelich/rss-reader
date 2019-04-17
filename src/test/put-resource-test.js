import * as databaseUtils from '/src/test/database-utils.js';
import * as indexedDBUtils from '/src/lib/indexeddb-utils.js';
import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import putResource from '/src/db/put-resource.js';

async function putResourceTest() {
  const databaseNamePrefix = 'put-resource-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  const title = 'first';
  const type = 'entry';
  const parent = 1; // fake parent resource id
  const id = await createResource(conn, { title, type, parent });
  const mode = 'id';
  let resource = await getResource(conn, { mode, id });
  assert(resource);
  assert(resource.title === 'first');

  resource.title = 'second';
  await putResource(conn, resource);
  resource = await getResource(conn, { mode, id });
  assert(resource);
  assert(resource.id === id);
  assert(resource.title === 'second');

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(putResourceTest);
