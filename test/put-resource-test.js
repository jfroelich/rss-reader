import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import create_resource from '/src/db/create-resource.js';
import get_resource from '/src/db/get-resource.js';
import put_resource from '/src/db/put-resource.js';
import * as database_utils from '/test/database-utils.js';

export default async function put_resource_test() {
  const database_name_prefix = 'put-resource-test';
  await database_utils.remove_databases_for_prefix(database_name_prefix);
  const database_name =
      database_utils.create_unique_database_name(database_name_prefix);


  const conn = await database_utils.create_test_database(database_name);

  const fake_parent_id = 1;
  const id = await create_resource(
      conn, {title: 'first', type: 'entry', parent: fake_parent_id});
  let resource = await get_resource({conn: conn, mode: 'id', id: id});
  assert(resource);
  assert(resource.title === 'first');
  resource.title = 'second';
  await put_resource(conn, resource);
  resource = await get_resource({conn: conn, mode: 'id', id: id});
  assert(resource);
  assert(resource.title === 'second');

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
