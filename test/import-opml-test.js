import assert from '/lib/assert.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import * as db from '/src/db/db.js';
import importOPML from '/src/import-opml.js';
import * as databaseUtils from '/test/database-utils.js';

export default async function import_opml_test() {
  const database_name_prefix = 'import-opml-test';
  await databaseUtils.remove_databases_for_prefix(database_name_prefix);
  const database_name = databaseUtils.create_unique_database_name(database_name_prefix);

  const conn = await databaseUtils.create_test_database(database_name);

  const opml_string = '<opml version="2.0"><body><outline type="feed" '
      + 'xmlUrl="a://b/c"/></body></opml>';

  // Mimic a File by creating a Blob, as File implements the Blob interface
  const file = new Blob([opml_string], { type: 'application/xml' });
  file.name = 'file.xml';

  const results = await importOPML(conn, [file]);

  assert(results);
  assert(results.length === 1);
  assert(db.isValidId(results[0]));
  assert(conn.channel.messages.length);
  assert(conn.channel.messages[0].type === 'resource-created');
  assert(conn.channel.messages[0].id === 1);

  conn.close();
  await indexedDBUtils.remove(conn.conn.name);
}
