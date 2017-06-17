// See license.md

'use strict';

async function jrCLIArchiveEntries() {
  const db = new ReaderDb();
  const es = new EntryStore();

  const ea = new EntryArchiver();
  ea.entryStore = es;
  ea.verbose = true;

  try {
    es.conn = await db.jrDbConnect();
    await ea.archive();
  } finally {
    if(es.conn)
      es.conn.close();
  }
}

async function jrCLIPollFeeds(nolog) {
  const service = new PollingService();
  service.ignoreIdleState = true;
  service.ignoreModifiedCheck = true;
  service.ignoreRecencyCheck = true;

  if(!nolog) {
    service.log = console;
    service.fs.log = console;
  }

  await service.jrPollFeeds();
}
