import assert from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as ops from '/src/ops.js';

export async function import_opml_test() {
  const db_name = 'import-opml-test-db';

  // Open without a channel, we will inject our own fake one
  const session = await cdb.open(db_name);

  let iconn = undefined;  // test without favicon caching support
  const messages = [];

  session.channel = {
    name: 'import-opml-test',
    postMessage: message => messages.push(message),
    close: noop
  };

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';
  const file = create_opml_file('file.xml', opml_string);

  const results = await ops.opml_import(session, [file]);
  assert(results);
  assert(results.length === 1);
  assert(cdb.is_valid_feed_id(results[0]));

  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === 1);

  session.close();
  await cdb.remove(db_name);
}

function create_opml_file(name, text) {
  const file = new Blob([text], {type: 'application/xml'});
  file.name = name;
  return file;
}

function noop() {}
