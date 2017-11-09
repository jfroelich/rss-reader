'use strict';

// import rbl.js

// TODO: move to reader-storage.js
// TODO: deprecate. this should probably be two functions that the caller has
// to call, one being load feeds and the other being export feeds. The caller
// should compose them
// @throws {AssertionError}
// @throws {Error} database related
// @throws {Error} opml related
async function optionsPageExportOPML() {
  // Allow errors to bubble
  let conn, feeds;
  try {
    conn = await readerDbOpen();
    feeds = await readerDbGetFeeds(conn);
  } finally {
    closeDB(conn);
  }

  assert(feeds);

  const title = 'Subscriptions', fileName = 'subscriptions.xml';
  readerExportFeeds(feeds, title, fileName);
}
