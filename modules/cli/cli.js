// See license.md

'use strict';

// Command line interface module. For performing operations from the console,
// with logging to console.

class cli {
  static async archiveEntries() {
    const db = new FeedDb();
    db.log = console;
    try {
      await db.connect();
      await archive_entries(db, undefined, console);
    } finally {
      if(db)
        db.close();
    }
  }

  static async pollFeeds(nolog) {
    const service = new PollingService();
    service.ignoreIdleState = true;
    service.ignoreModifiedCheck = true;
    service.ignoreRecencyCheck = true;

    if(!nolog) {
      service.log = console;
      service.db.log = console;
      service.fs.log = console;
      service.loader.log = console;
    }

    await service.pollFeeds();
  }
}
