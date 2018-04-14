import {idb_remove} from '/src/lib/idb/idb.js';
import {rdr_archive} from '/src/ops/rdr-archive-entries.js';
import {rdr_create_conn} from '/src/ops/rdr-create-conn.js';

const channel_stub = {
  name: 'channel-stub',
  postMessage: noop,
  close: noop
};

async function test() {
  let version, timeout, max_age;
  const conn =
      await rdr_create_conn('archive-entries-test', version, timeout, console);

  // Create and use an archive context
  const ac = {};
  ac.conn = conn;
  ac.channel = channel_stub;
  ac.console = console;
  ac.max_age = undefined;
  await rdr_archive.call(ac);

  conn.close();
  await idb_remove(conn.name);
}

function noop() {}

window.test = test;
