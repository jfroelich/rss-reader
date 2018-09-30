import assert from '/src/assert/assert.js';
import {archive_entries} from '/src/db/archive-entries.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';
import {register_test} from '/src/test/test-registry.js';

// NOTE: At the moment this test is a nominal stub that does not actually test
// anything

// TODO: insert archivable data, non-archivable data, and then assert the
// archivable data was archived, and that the non-archivable data was not
// archived
// TODO: assert channeled messages work

async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  const session = await open(db_name);
  const max_age = 100;
  const ids = await archive_entries(session, max_age);
  session.close();
  await remove(db_name);
}

register_test(archive_entries_test);
