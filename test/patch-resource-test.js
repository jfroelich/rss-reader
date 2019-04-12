import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import patchResource from '/src/db/patch-resource.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function patch_resource_test() {
  const database_name_prefix = 'patch-resource-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const id = await createResource(conn, { type: 'entry', read: 0 });

  let match = await getResource({ conn, mode: 'id', id });
  assert(match);
  assert(match.read === 0);

  await patchResource(conn, { id, read: 1 });
  match = await getResource({ conn, mode: 'id', id });
  assert(match);
  assert(match.read === 1);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
