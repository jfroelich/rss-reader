import {export_opml as export_opml_impl, import_opml as import_opml_impl} from '/src/exim.js';
import {open as favicon_service_open} from '/src/favicon-service.js';
import {open as reader_db_open, reader_db_for_each_active_feed, reader_db_viewable_entries_for_each} from '/src/rdb.js';

// Resource acquisition layer (RAL). An intermediate layer between storage and
// the view that helps calls acquire and release needed resources, and supplies
// some default values

// @param files {FileList}
// @param channel {BroadcastChannel}
export async function ral_import(channel, files) {
  // Given that there could be several feeds being subscribed, use a slightly
  // higher timeout than average to reduce the chance that some contention
  // delays result in failure. Defined here so caller does not need to worry
  // about it.
  const fetch_feed_timeout = 10 * 1000;
  let reader_conn, favicon_conn;

  try {
    [reader_conn, favicon_conn] =
        await Promise.all([reader_db_open(), favicon_service_open()]);
    await import_opml_impl(
        reader_conn, favicon_conn, channel, fetch_feed_timeout, files);
  } finally {
    if (reader_conn) reader_conn.close();
    if (favicon_conn) favicon_conn.close();
  }
}

// Returns a blob of an opml xml file containing feeds from storage
// @param title {String} the value of the title element in the opml file
// @returns {Blob} a promise that resolves to a blob
export async function ral_export(title) {
  let conn;
  try {
    conn = await reader_db_open();
    export_opml_impl(conn, title);
  } finally {
    if (conn) conn.close();
  }
}

// Opens a connection to indexedDB. Then walks the entry store for viewable
// entries and calls back to entry_handler as each entry is visited. Then walks
// the feed store for feeds and calls back to feed_handler as each feed is
// visited. Then closes the connection.
// @param entry_cursor_offset {Number} the number of entries to skip past before
// starting to pass entries back to visitor function
// @param entry_handler {Function} called for each visited entry with the loaded
// entry object
// @param feed_handler {Function} called for each visited feed with the loaded
// feed object
export async function ral_load_initial(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  let conn;
  try {
    conn = await reader_db_open();

    const p1 = reader_db_viewable_entries_for_each(
        conn, entry_cursor_offset, entry_cursor_limit, entry_handler);
    const p2 = reader_db_for_each_active_feed(conn, feed_handler);

    await Promise.all([p1, p2]);
  } finally {
    if (conn) {
      console.debug('Closing connection', conn.name);
      conn.close();
    }
  }
}
