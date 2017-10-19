'use strict';

async function options_page_export_opml() {
  const title = 'Subscriptions', file_name = 'subscriptions.xml';

  // Connect, load feeds, disconnect
  let conn, feeds;
  try {
    conn = await reader_db_open();
    feeds = await reader_db_get_feeds(conn);
  } catch(error) {
    DEBUG(error);
    return ERR_DB_OP;
  } finally {
    if(conn)
      conn.close();
  }

  ASSERT(feeds);

  const status = await reader_export_feeds(feeds, title, file_name);
  return status;
}
