import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import patchResource from '/src/db/patch-resource.js';

async function patchResourceTest() {
  const databaseNamePrefix = 'patch-resource-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);
  const conn = await databaseUtils.createTestDatabase(databaseName);

  const id = await createResource(conn, { type: 'entry', read: 0 });
  let match = await getResource(conn, { mode: 'id', id });
  assert(match);
  assert(match.read === 0);

  await patchResource(conn, { id, read: 1 });
  match = await getResource(conn, { mode: 'id', id });
  assert(match);
  assert(match.read === 1);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(patchResourceTest);
