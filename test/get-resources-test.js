import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import create_resource from '/src/db/create-resource.js';
import get_resources from '/src/db/get-resources.js';
import * as resource_utils from '/src/db/resource-utils.js';
import * as database_utils from '/test/database-utils.js';

export default async function get_resources_test() {
  const database_name_prefix = 'get-resources-test';
  await database_utils.remove_databases_for_prefix(database_name_prefix);
  const database_name =
      database_utils.create_unique_database_name(database_name_prefix);

  const conn = await database_utils.create_test_database(database_name);

  const create_promises = [];
  for (let i = 0; i < 5; i++) {
    create_promises.push(
        create_resource(conn, {title: 'test' + i, type: 'entry'}));
  }
  await Promise.all(create_promises);

  const resources = await get_resources({conn: conn, mode: 'all'});

  assert(resources.length === 5);


  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
