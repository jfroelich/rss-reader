import {idb_remove} from '/src/lib/idb/idb.js';
import {archive_entries} from '/src/ops/archive-entries.js';
import {create_conn} from '/src/ops/create-conn.js';

const channel_stub = {
  name: 'channel-stub',
  postMessage: noop,
  close: noop
};

async function test() {
  let version, timeout, max_age;
  const conn =
      await create_conn('archive-entries-test', version, timeout, console);

  // Create and use an archive context
  const ac = {};
  ac.conn = conn;
  ac.channel = channel_stub;
  ac.console = console;
  await archive_entries.call(ac, max_age);

  conn.close();
  await idb_remove(conn.name);
}

function noop() {}

window.test = test;
