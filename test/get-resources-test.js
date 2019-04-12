import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import createResource from '/src/db/create-resource.js';
import getResources from '/src/db/get-resources.js';
import * as resourceUtils from '/src/db/resource-utils.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function get_resources_test() {
  const database_name_prefix = 'get-resources-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const create_promises = [];
  for (let i = 0; i < 5; i++) {
    create_promises.push(
      createResource(conn, { title: `test${i}`, type: 'entry' }),
    );
  }
  await Promise.all(create_promises);

  const resources = await getResources({ conn, mode: 'all' });

  assert(resources.length === 5);


  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
