import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import createResource from '/src/db/create-resource.js';
import getResource from '/src/db/get-resource.js';
import putResource from '/src/db/put-resource.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function put_resource_test() {
  const database_name_prefix = 'put-resource-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);


  const conn = await databaseUtils.create_test_database(database_name);

  const fake_parent_id = 1;
  const id = await createResource(
    conn, { title: 'first', type: 'entry', parent: fake_parent_id },
  );
  let resource = await getResource({ conn, mode: 'id', id });
  assert(resource);
  assert(resource.title === 'first');
  resource.title = 'second';
  await putResource(conn, resource);
  resource = await getResource({ conn, mode: 'id', id });
  assert(resource);
  assert(resource.title === 'second');

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
