import create_resource from '/src/db/ops2/create-resource.js';
import delete_resource from '/src/db/ops2/delete-resource.js';
import get_resource from '/src/db/ops2/get-resource.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export default async function delete_resource_test() {
  const db_name = 'delete-resource-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const feed = {type: 'feed', urls: ['a://b.c']};
  const feed_id = await create_resource(conn, feed);
  const entry = {type: 'entry', parent: feed_id};
  const entry_id = await create_resource(conn, entry);

  await delete_resource(conn, feed_id, 'test');

  let match = await get_resource({conn: conn, mode: 'id', id: feed_id});
  assert(!match);

  assert(conn.channel.messages.length);

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
