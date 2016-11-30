// See license.md

'use strict';

// Command line interface module. For performing operations from the console,
// with logging to console.

class cli {

  static async archiveEntries() {
    const db = new ReaderDb();
    const es = new EntryStore();

    const ea = new EntryArchiver();
    ea.entryStore = es;
    ea.verbose = true;

    try {
      es.conn = await db.connect();
      await ea.archive();
    } finally {
      if(es.conn)
        es.conn.close();
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
