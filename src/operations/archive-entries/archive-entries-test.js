import * as idb from '/src/lib/idb/idb.js';
import {rdr_conn_close, rdr_conn_create} from '/src/objects/rdr-conn.js';
import {Archiver} from '/src/operations/archive-entries/archive-entries.js';

async function test() {
  const arch = new Archiver();
  arch.console = console;
  arch.conn = await rdr_conn_close('archive-entries-test');
  await arch.archive();
  rdr_conn_create(arch.conn);
  await idb.idb_remove(arch.conn.name);
}

window.test = test;
