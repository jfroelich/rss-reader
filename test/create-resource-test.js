import * as databaseUtils from '/test/database-utils.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import * as resourceUtils from '/src/db/resource-utils.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';

async function createResourceTest() {
  const databaseNamePrefix = 'create-resource-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  const resource = {};
  resource.type = 'feed';
  const url = new URL('a://b.c');
  resourceUtils.setURL(resource, url);

  const id = await createResource(conn, resource);
  assert(resourceUtils.isValidId(id));

  let match = await getResource(conn, { mode: 'id', id, keyOnly: false });
  assert(match);

  match = await getResource(conn, { mode: 'url', url, keyOnly: true });
  assert(match);

  // Creating a feed without a url is an error
  delete resource.urls;
  let expectedError;
  try {
    await createResource(conn, resource);
  } catch (error) {
    expectedError = error;
  }
  assert(expectedError);

  // Creating a feed that has an id but is otherwise valid is an error
  resourceUtils.setURL(resource, url);
  resource.id = id;
  expectedError = undefined;
  try {
    await createResource(conn, resource);
  } catch (error) {
    expectedError = error;
  }
  assert(expectedError);

  // Creating a duplicate resource is an error
  expectedError = undefined;
  delete resource.id;
  try {
    await createResource(conn, resource);
  } catch (error) {
    expectedError = error;
  }
  assert(expectedError);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}

TestRegistry.registerTest(createResourceTest);
