import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import create_resource from '/src/db/create-resource.js';
import get_resources from '/src/db/get-resources.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/test/test-open.js';

export default async function get_resources_test() {
  const db_name = 'get-resources-test';
  await indexeddb_utils.remove(db_name);
  const conn = await test_open(db_name);

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
