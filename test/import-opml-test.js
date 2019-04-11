import assert from '/lib/assert.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import import_opml from '/src/import-opml.js';
import * as database_utils from '/test/database-utils.js';

export default async function import_opml_test() {
  const db_name = 'import-opml-test';
  await indexeddb_utils.remove(db_name);

  const conn = await database_utils.create_test_database(db_name);

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';

  // Mimic a File by creating a Blob, as File implements the Blob interface
  const file = new Blob([opml_string], {type: 'application/xml'});
  file.name = 'file.xml';

  const results = await import_opml(conn, [file]);

  assert(results);
  assert(results.length === 1);
  assert(db.is_valid_id(results[0]));
  assert(conn.channel.messages.length);
  assert(conn.channel.messages[0].type === 'resource-created');
  assert(conn.channel.messages[0].id === 1);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
