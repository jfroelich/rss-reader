import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import ModelAccess from '/src/model/model-access.js';
import {register_test} from '/src/test/test-registry.js';

async function archive_entries_test() {
  const ma = new ModelAccess();
  await ma.connect('archive-entries-test');
  ma.channel = {name: 'stub', postMessage: noop, close: noop};
  await ma.archiveEntries();

  // TODO: actually assert something, what am I trying to test other than 'does
  // it run'? I need to insert archivable data, non-archivable data, and then
  // assert the archivable data was archived, and that the non-archivable data
  // was not archived, and that messages were posted

  ma.close();
  ma.channel.close();
  await indexeddb.remove(ma.conn.name);
}

function noop() {}

register_test(archive_entries_test);
