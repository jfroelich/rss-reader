import assert, { AssertionError } from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import * as resourceUtils from '/src/db/resource-utils.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function create_resource_test() {
  const database_name_prefix = 'create-resource-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const resource = {};
  resource.type = 'feed';
  const url = new URL('a://b.c');
  resourceUtils.setURL(resource, url);

  const id = await createResource(conn, resource);
  assert(resourceUtils.isValidId(id));

  let match = await getResource({
    conn, mode: 'id', id, key_only: false,
  });
  assert(match);

  match = await getResource({
    conn, mode: 'url', url, key_only: true,
  });
  assert(match);

  // Creating a feed without a url is an error
  delete resource.urls;
  let expected_error;
  try {
    await createResource(conn, resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error);

  // Creating a feed that has an id but is otherwise valid is an error
  resourceUtils.setURL(resource, url);
  resource.id = id;
  expected_error = undefined;
  try {
    await createResource(conn, resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error);

  // Creating a duplicate resource is an error
  expected_error = undefined;
  delete resource.id;
  try {
    await createResource(conn, resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
