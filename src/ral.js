import {export_opml as export_opml_impl, import_opml as import_opml_impl} from '/src/exim.js';
import {open as favicon_service_open} from '/src/favicon-service.js';
import {open as reader_db_open} from '/src/rdb.js';

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
