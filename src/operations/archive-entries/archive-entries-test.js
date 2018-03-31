import {idb_remove} from '/src/lib/idb/idb.js';
import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';
import {rdr_archive} from '/src/operations/archive-entries/archive-entries.js';

async function test() {
  const conn = await rdr_create_conn('archive-entries-test');
  await rdr_archive(conn, /* channel */ null, console, /* max_age */ null);
  conn.close;
  await idb_remove(conn.name);
}

window.test = test;
