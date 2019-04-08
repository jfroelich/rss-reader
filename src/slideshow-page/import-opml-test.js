import assert from '/src/assert.js';
import * as db from '/src/db/db.js';
import import_opml from '/src/slideshow-page/import-opml.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export default async function import_opml_test() {
  const db_name = 'import-opml-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db.test_open(db_name);

  let iconn = undefined;  // test without favicon caching support

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';

  const file = new Blob([opml_string], {type: 'application/xml'});
  file.name = 'file.xml';

  const files = [file];
  const results = await import_opml(conn, files);
  assert(results);
  assert(results.length === 1);
  assert(db.is_valid_id(results[0]));

  assert(conn.channel.messages.length === 1);
  assert(conn.channel.messages[0].type === 'feed-created');
  assert(conn.channel.messages[0].id === 1);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
