import {for_each_active_feed} from '/src/operations/for-each-active-feed.js';
import {rdr_create_conn} from '/src/operations/rdr-create-conn.js';
import {rdr_create_icon_conn} from '/src/operations/rdr-create-icon-conn.js';
import {rdr_import} from '/src/operations/rdr-import-opml.js';
import {viewable_entries_for_each} from '/src/operations/viewable-entries-for-each.js';

export async function import_opml(channel, files) {
  const ctx = {};
  ctx.fetch_timeout = 10 * 100;
  ctx.channel = channel;
  ctx.console = console;

  const open_promises = [rdr_create_conn(), rdr_create_icon_conn()];
  [ctx.rconn, ctx.iconn] = await Promise.all(open_promises);
  await rdr_import(ctx, files);
  ctx.rconn.close();
  ctx.iconn.close();
}

export async function load_initial_data(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  const conn = await rdr_create_conn();
  const p1 = viewable_entries_for_each(
      conn, entry_cursor_offset, entry_cursor_limit, entry_handler);
  const p2 = for_each_active_feed(conn, feed_handler);
  await Promise.all([p1, p2]);
  conn.close();
}
