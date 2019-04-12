import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import createResource from '/src/db/create-resource.js';
import deleteResource from '/src/db/delete-resource.js';
import getResource from '/src/db/get-resource.js';
import * as resourceUtils from '/src/db/resource-utils.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function delete_resource_test() {
  const database_name_prefix = 'delete-resource-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const feed = { type: 'feed', urls: ['a://b.c'] };
  const feed_id = await createResource(conn, feed);
  const entry = { type: 'entry', parent: feed_id };
  const entry_id = await createResource(conn, entry);

  await deleteResource(conn, feed_id, 'test');

  const match = await getResource({ conn, mode: 'id', id: feed_id });
  assert(!match);

  assert(conn.channel.messages.length);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
