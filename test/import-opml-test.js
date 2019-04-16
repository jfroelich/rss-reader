import * as databaseUtils from '/test/database-utils.js';
import * as db from '/src/db/db.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import importOPML from '/src/service/import-opml.js';

async function importOPMLTest() {
  const databaseNamePrefix = 'import-opml-test';
  await databaseUtils.removeDatabasesForPrefix(databaseNamePrefix);
  const databaseName = databaseUtils.createUniqueDatabaseName(databaseNamePrefix);

  const conn = await databaseUtils.createTestDatabase(databaseName);

  const opmlString = '<opml version="2.0"><body><outline type="feed" xmlUrl="a://b/c"/></body></opml>';

  // Mimic a File by creating a Blob, as File implements the Blob interface
  const file = new Blob([opmlString], { type: 'application/xml' });
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

TestRegistry.registerTest(importOPMLTest);
