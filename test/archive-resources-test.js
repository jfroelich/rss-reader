import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import archiveResources from '/src/db/archive-resources.js';
import createResource from '/src/db/create-resource.js';
import getResources from '/src/db/get-resources.js';
import * as databaseUtils from '/test/database-utils.js';

// Exercise typical execution of archive-resources
export default async function archiveResourcesTest() {
  const database_name_prefix = 'archive-resources-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const create_promises = [];
  for (let i = 0; i < 5; i++) {
    const resource = {
      title: `title ${i}`, content: 'foo', read: 1, type: 'entry',
    };
    create_promises.push(createResource(conn, resource));
  }

  const ids = await Promise.all(create_promises);

  // pseudo advance clock so that entries expire
  await new Promise(resolve => setTimeout(resolve, 50));
  const max_age = 1;
  await archiveResources(conn, max_age);

  const resources = await getResources({ conn, mode: 'all' });
  assert(resources.length === 5);

  for (const resource of resources) {
    assert(ids.includes(resource.id));
    assert(resource.archived === 1);
    assert(resource.content === undefined);
    assert(resource.archived_date instanceof Date);
  }

  // TODO: test running a second time and verifying nothing happens

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
