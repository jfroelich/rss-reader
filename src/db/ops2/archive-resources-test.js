import archive_resources from '/src/db/ops2/archive-resources.js';
import create_resource from '/src/db/ops2/create-resource.js';
import get_resources from '/src/db/ops2/get-resources.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

// Exercise typical execution of archive-resources
export default async function archive_resources_test() {
  const db_name = 'archive-resources-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const create_promises = [];
  for (let i = 0; i < 5; i++) {
    const resource =
        {title: 'title ' + i, content: 'foo', read: 1, type: 'entry'};
    create_promises.push(create_resource(conn, resource));
  }

  const ids = await Promise.all(create_promises);

  // pseudo advance clock so that entries expire
  await new Promise(resolve => setTimeout(resolve, 50));
  const max_age = 1;
  await archive_resources(conn, max_age);

  const resources = await get_resources({conn: conn, mode: 'all'});
  assert(resources.length === 5);

  for (const resource of resources) {
    assert(ids.includes(resource.id));
    assert(resource.archived === 1);
    assert(resource.content === undefined);
    assert(resource.archived_date instanceof Date);
  }

  // TODO: test running a second time and verifying nothing happens

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
