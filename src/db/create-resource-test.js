import assert, {AssertionError} from '/src/assert.js';
import create_resource from '/src/db/create-resource.js';
import get_resource from '/src/db/get-resource.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export default async function create_resource_test() {
  const db_name = 'create-resource-test';
  await indexeddb_utils.remove(db_name);
  const conn = await test_open(db_name);

  const resource = {};
  resource.type = 'feed';
  const url = new URL('a://b.c');
  resource_utils.set_url(resource, url);

  const id = await create_resource(conn, resource);
  assert(resource_utils.is_valid_id(id));

  let match =
      await get_resource({conn: conn, mode: 'id', id: id, key_only: false});
  assert(match);

  match =
      await get_resource({conn: conn, mode: 'url', url: url, key_only: true});
  assert(match);

  // Creating a feed without a url is an error
  delete resource.urls;
  let expected_error;
  try {
    await create_resource(conn, resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error);

  // Creating a feed that has an id but is otherwise valid is an error
  resource_utils.set_url(resource, url);
  resource.id = id;
  expected_error = undefined;
  try {
    await create_resource(conn, resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error);

  // Creating a duplicate resource is an error
  expected_error = undefined;
  delete resource.id;
  try {
    await create_resource(conn, resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error);

  conn.close();
  await indexeddb_utils.remove(conn.conn.name);
}
