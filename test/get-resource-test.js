import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function get_resource_test() {
  const database_name_prefix = 'get-resource-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const resource = { type: 'entry', title: 'test' };
  const id = await createResource(conn, resource);

  const match = await getResource({ conn, mode: 'id', id });
  assert(match);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
