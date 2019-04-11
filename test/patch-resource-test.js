import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import create_resource from '/src/db/create-resource.js';
import get_resource from '/src/db/get-resource.js';
import patch_resource from '/src/db/patch-resource.js';
import * as database_utils from '/test/database-utils.js';

export default async function patch_resource_test() {
  const database_name_prefix = 'patch-resource-test';
  await database_utils.remove_databases_for_prefix(database_name_prefix);
  const database_name =
      database_utils.create_unique_database_name(database_name_prefix);

  const conn = await database_utils.create_test_database(database_name);

  const id = await create_resource(conn, {type: 'entry', read: 0});

  let match = await get_resource({conn: conn, mode: 'id', id: id});
  assert(match);
  assert(match.read === 0);

  await patch_resource(conn, {id: id, read: 1});
  match = await get_resource({conn: conn, mode: 'id', id: id});
  assert(match);
  assert(match.read === 1);

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
