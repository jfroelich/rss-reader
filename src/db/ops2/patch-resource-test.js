import create_resource from '/src/db/ops2/create-resource.js';
import get_resource from '/src/db/ops2/get-resource.js';
import patch_resource from '/src/db/ops2/patch-resource.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export default async function patch_resource_test() {
  const database_name = 'patch-resource-test';
  await indexeddb_utils.remove(database_name);
  const conn = await test_open(database_name);

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
