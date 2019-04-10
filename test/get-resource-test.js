import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import create_resource from '/src/db/create-resource.js';
import get_resource from '/src/db/get-resource.js';
import test_open from '/test/test-open.js';

export default async function get_resource_test() {
  const db_name = 'get-resource-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const resource = {type: 'entry', title: 'test'};
  const id = await create_resource(conn, resource);

  let match = await get_resource({conn: conn, mode: 'id', id: id});
  assert(match);

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}