'use strict';

// import base/assert.js

// TODO: move to reader-storage.js
// TODO: this should probably be two functions that the caller has to call,
// one being load feeds and the other being export feeds. The caller should
// compose them
async function optionsPageExportOPML() {
  const title = 'Subscriptions', fileName = 'subscriptions.xml';

  // Connect, load feeds, disconnect
  let conn, feeds;
  try {
    conn = await readerDbOpen();
    feeds = await readerDbGetFeeds(conn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  } finally {
    indexedDBClose(conn);
  }

  assert(feeds);

  const status = await readerExportFeeds(feeds, title, fileName);
  return status;
}
