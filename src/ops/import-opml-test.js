import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import {import_opml} from '/src/ops/import-opml.js';

export async function import_opml_test() {
  const db_name = 'ops-import-opml-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  let iconn = undefined;  // test without favicon caching support

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';

  const file = new Blob([opml_string], {type: 'application/xml'});
  file.name = 'file.xml';

  const files = [file];
  const results = await import_opml(conn, files);
  assert(results);
  assert(results.length === 1);
  assert(identifiable.is_valid_id(results[0]));

  assert(conn.channel.messages.length === 1);
  assert(conn.channel.messages[0].type === 'feed-created');
  assert(conn.channel.messages[0].id === 1);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
