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
    await poll.run({
      'ignore_idle_state': 1,
      'skip_unmodified_guard': 1,
      'ignore_recent_poll_guard': 1,
      'log': nolog ? undefined : console
    });
  }
}
