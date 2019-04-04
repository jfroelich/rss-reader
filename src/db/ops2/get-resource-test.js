import create_resource from '/src/db/ops2/create-resource.js';
import get_resource from '/src/db/ops2/get-resource.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

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
