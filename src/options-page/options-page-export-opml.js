'use strict';

// TODO: this belongs in app middle layer rather than view layer
// TODO: this should probably be two functions that the caller has to call,
// one being load feeds and the other being export feeds. The caller should
// compose them
async function options_page_export_opml() {
  const title = 'Subscriptions', file_name = 'subscriptions.xml';

  // Connect, load feeds, disconnect
  let conn, feeds;
  try {
    conn = await reader_db_open();
    feeds = await reader_db_get_feeds(conn);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  } finally {
    indexeddb_close(conn);
  }

  console.assert(feeds);

  const status = await reader_export_feeds(feeds, title, file_name);
  return status;
}
