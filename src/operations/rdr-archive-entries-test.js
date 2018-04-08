import {idb_remove} from '/src/lib/idb/idb.js';
import {rdr_archive} from '/src/operations/rdr-archive-entries.js';
import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';

const channel_stub = {
  name: 'channel-stub',
  postMessage: noop,
  close: noop
};

async function test() {
  // TODO: rdr_create_conn should accept a console parameter, and this should
  // pass along console

  let max_age;
  let version;
  let timeout;
  const conn = await rdr_create_conn('archive-entries-test', version, timeout);
  await rdr_archive(conn, channel_stub, console, max_age);
  conn.close;
  await idb_remove(conn.name);
}

function noop() {}

window.test = test;
