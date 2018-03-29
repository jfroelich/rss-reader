import {idb_remove} from '/src/lib/idb/idb.js';
import {rdr_conn_close, rdr_conn_create} from '/src/objects/rdr-conn.js';
import {rdr_archive} from '/src/operations/archive-entries/archive-entries.js';

async function test() {
  const conn = await rdr_conn_create('archive-entries-test');
  await rdr_archive(conn, /* channel */ null, console, /* max_age */ null);
  rdr_conn_close(conn);
  await idb_remove(conn.name);
}

window.test = test;
