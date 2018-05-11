import {create_conn} from '/src/db.js';
import {archive_entries} from '/src/entry-store/archive-entries.js';
import {console_stub} from '/src/lib/console-stub.js';
import {idb_remove} from '/src/lib/idb.js';
import {assert} from '/src/tests/assert.js';

// TODO: actually assert something, what am I trying to test other than 'does it
// run'? I need to insert archivable data, non-archivable data, and then assert
// the archivable data was archived, and that the non-archivable data was not
// archived

// TODO: I don't think there is a need to use explicit console parameter here,
// just call create-conn without 4th param?

export async function archive_entries_test() {
  let dbname = 'archive-entries-test', version, timeout, max_age;
  const conn = await create_conn(dbname, version, timeout, console_stub);
  const op = {};
  op.conn = conn;
  op.channel = {name: 'stub', postMessage: noop, close: noop};
  op.console = console;
  op.archive_entries = archive_entries;
  await op.archive_entries(max_age);

  conn.close();
  await idb_remove(conn.name);
}

function noop() {}
