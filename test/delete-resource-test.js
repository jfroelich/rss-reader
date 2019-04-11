import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import create_resource from '/src/db/create-resource.js';
import delete_resource from '/src/db/delete-resource.js';
import get_resource from '/src/db/get-resource.js';
import * as resource_utils from '/src/db/resource-utils.js';
import * as database_utils from '/test/database-utils.js';

export default async function delete_resource_test() {
  const db_name = 'delete-resource-test';
  await indexeddb_utils.remove(db_name);

  const conn = await database_utils.create_test_database(db_name);

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
