import * as rdb from '/src/app/handles/rdb.js';
import {Archiver} from '/src/feed-ops/archive-entries.js';
import * as idb from '/src/idb/idb.js';

async function test() {
  const arch = new Archiver();
  arch.console = console;
  arch.conn = await rdb.open('archive-entries-test');
  await arch.archive();
  arch.conn.close();
  await idb.idb_remove(arch.conn.name);
}

window.test = test;
