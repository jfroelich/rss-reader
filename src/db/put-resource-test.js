import create_resource from '/src/db/create-resource.js';
import get_resource from '/src/db/get-resource.js';
import put_resource from '/src/db/put-resource.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export default async function put_resource_test() {
  const db_name = 'put-resource-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

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
