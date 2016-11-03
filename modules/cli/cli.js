// See license.md

'use strict';

// Command line interface module. For performing operations from the console,
// with logging to console.
const cli = {};

cli.archive_entries = async function() {
  try {
    const conn = await db_connect(undefined, undefined, console);
    const num_modified = await archive_entries(conn, undefined, console);
    conn.close();
  } catch(error) {
    console.debug(error);
  }
};

cli.poll_feeds = async function() {
  try {
    await poll_feeds({
      'ignore_idle_state': 1,
      'force_reset_lock': 1,
      'skip_unmodified_guard': 1,
      'log': console
    });
  } catch(error) {
    console.debug(error);
  }
};
