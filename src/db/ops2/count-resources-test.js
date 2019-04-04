import count_resources from '/src/db/ops2/count-resources.js';
import create_resource from '/src/db/ops2/create-resource.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export default async function count_resources_test() {
  const db_name = 'count-resources-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

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
