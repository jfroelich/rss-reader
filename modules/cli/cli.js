// See license.md

'use strict';

// Command line interface module. For performing operations from the console,
// with logging to console.
const cli = {};

cli.archive_entries = async function() {
  let conn;
  try {
    conn = await db_connect(undefined, undefined, console);
    const n = await archive_entries(conn, undefined, console);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn)
      conn.close();
  }
};

cli.poll_feeds = async function() {
  try {
    await poll_feeds({
      'ignore_idle_state': 1,
      'skip_unmodified_guard': 1,
      'log': console
    });
  } catch(error) {
    console.debug(error);
  }
};
