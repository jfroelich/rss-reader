import {import_opml} from '/src/action/import-opml.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import {openModelAccess} from '/src/model/model-access.js';
import {register_test} from '/src/test/test-registry.js';

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
      'xmlUrl="http://www.example.com/example.rss"/></body></opml>';
  const file = create_mock_file('file.xml', opml_string);
  const results = await import_opml(ma, [file]);
  assert(results.length === 1);
  assert(results[0].id === 1);
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === 1);

  ma.close();
  await indexeddb.remove(ma.conn.name);
}

// We cannot create File objects directly. However, blobs effectively implement
// the File interface, so really, we just create a blob, and users of the file
// such as FileReader do not really know the difference so long as duck typing
// is used and no pedantic instanceof shenanigans are present.
function create_mock_file(name, text) {
  const file = new Blob([text], {type: 'application/xml'});
  file.name = name;
  return file;
}

function noop() {}

register_test(import_opml_test);
