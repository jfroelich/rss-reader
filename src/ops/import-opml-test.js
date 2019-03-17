import {Feed, is_feed} from '/src/db/object/feed.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import {import_opml} from '/src/ops/import-opml.js';

export async function import_opml_test() {
  const db_name = 'ops-import-opml-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  let iconn = undefined;  // test without favicon caching support
  const messages = [];

  // Provide a new mocked channel
  const channel = {
    name: 'import-opml-test',
    postMessage: message => messages.push(message),
    close: function() {}
  };

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';

  const file = new Blob([opml_string], {type: 'application/xml'});
  file.name = 'file.xml';

  const files = [file];
  const results = await import_opml(conn, channel, files);
  assert(results);
  assert(results.length === 1);
  assert(Feed.isValidId(results[0]));

  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === 1);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
