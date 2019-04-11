import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import count_resources from '/src/db/count-resources.js';
import create_resource from '/src/db/create-resource.js';
import * as resource_utils from '/src/db/resource-utils.js';
import * as database_utils from '/test/database-utils.js';

export default async function count_resources_test() {
  const database_name_prefix = 'count-resources-test';
  await database_utils.remove_databases_for_prefix(database_name_prefix);
  const database_name =
      database_utils.create_unique_database_name(database_name_prefix);

  const conn = await database_utils.create_test_database(database_name);

  // Verify counting nothing is 0
  let count = await count_resources({conn: conn, read: 0, type: 'entry'});
  assert(count === 0);

  const create_promises = [];
  for (let i = 0; i < 8; i++) {
    const resource = {read: (i > 2 ? 1 : 0), title: 'test ' + i, type: 'entry'};
    create_promises.push(create_resource(conn, resource));
  }
  await Promise.all(create_promises);

  count = await count_resources({conn: conn, read: 0, type: 'entry'});
  assert(count === 3);

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
