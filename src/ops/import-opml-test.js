import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import {Feed, is_feed} from '/src/db/types/feed.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
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
  const file = create_opml_file('file.xml', opml_string);

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

// TODO: inline
function create_opml_file(name, text) {
  const file = new Blob([text], {type: 'application/xml'});
  file.name = name;
  return file;
}
