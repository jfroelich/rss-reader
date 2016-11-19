// See license.md

'use strict';

// Command line interface module. For performing operations from the console,
// with logging to console.

class cli {
  static async archiveEntries() {
    // TODO: archive_entries should just accept a connected entry store
    // instance as input, not the db conn itself
    const db = new ReaderDb();
    let conn;
    try {
      conn = await db.connect();
      await archive_entries(conn, undefined, console);
    } finally {
      if(conn)
        conn.close();
    }
  }

  static async pollFeeds(nolog) {
    const service = new PollingService();
    service.ignoreIdleState = true;
    service.ignoreModifiedCheck = true;
    service.ignoreRecencyCheck = true;

    if(!nolog) {
      service.log = console;
      service.fs.log = console;
    }

    await service.pollFeeds();
  }
}
