import assert from '/src/assert.js';
import {import_opml} from '/src/import-opml.js';
import * as indexeddb from '/src/indexeddb.js';
import {openModelAccess} from '/src/model/model-access.js';
import * as Model from '/src/model/model.js';
import {register_test} from '/test/test-registry.js';

// TODO: test multiple files
// TODO: test multiple feeds per file
// TODO: test dup handling

async function import_opml_test() {
  const ma = await openModelAccess(
      /* channeled */ false, 'import-opml-test-db', undefined, 3000);
  let iconn = undefined;  // test without favicon caching support
  const messages = [];
  ma.channel = {
    name: 'import-opml-test',
    postMessage: message => messages.push(message),
    close: noop
  };

  const opml_string = '<opml version="2.0"><body><outline type="feed" ' +
      'xmlUrl="a://b/c"/></body></opml>';
  const file = mock_opml_file('file.xml', opml_string);

  const results = await import_opml(ma, [file]);
  assert(results);
  assert(results.length === 1);
  assert(Model.is_valid_feed_id(results[0]));

  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === 1);

  ma.close();
  await indexeddb.remove(ma.conn.name);
}

// Blobs are files!
function mock_opml_file(name, text) {
  const file = new Blob([text], {type: 'application/xml'});
  // Blobs have type and size, but not a name (I think)
  file.name = name;
  return file;
}

function noop() {}

register_test(import_opml_test);
