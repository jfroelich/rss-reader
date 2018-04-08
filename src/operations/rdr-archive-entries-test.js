import {idb_remove} from '/src/lib/idb/idb.js';
import {rdr_archive} from '/src/operations/rdr-archive-entries.js';
import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';

async function test() {
  const conn = await rdr_create_conn('archive-entries-test');
  await rdr_archive(
      conn, /* channel */ undefined, console, /* max_age */ undefined);
  conn.close;
  await idb_remove(conn.name);
}

window.test = test;
