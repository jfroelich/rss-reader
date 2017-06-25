// See license.md

'use strict';

async function cliArchiveEntries() {
  let conn;
  let maxAge;// intentionally undefined
  try {
    conn = await db.connect();
    const numArchived = await operations.archiveEntries(conn, maxAge, console);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function cliPollFeeds(nolog) {
  const pollOptionsObject = {};
  pollOptionsObject.ignoreIdleState = true;
  pollOptionsObject.ignoreModifiedCheck = true;
  pollOptionsObject.ignoreRecencyCheck = true;
  await jrPollFeeds(console, pollOptionsObject);
}
