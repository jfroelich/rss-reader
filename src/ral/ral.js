import {export_opml as export_opml_impl, import_opml as import_opml_impl} from '/src/exim/exim.js';
import {open as favicon_service_open} from '/src/favicon-service/favicon-service.js';
import subscribe from '/src/feed-ops/subscribe.js';
import unsubscribe from '/src/feed-ops/unsubscribe.js';
import {poll_service_poll_feeds} from '/src/poll-service/poll-feeds.js';
import {rdb_feed_activate, rdb_feed_deactivate, rdb_for_each_active_feed, rdb_get_feeds, rdb_open, rdb_viewable_entries_for_each} from '/src/rdb/rdb.js';

export async function ral_get_feeds(title_sort_flag) {
  let conn, feeds;
  try {
    conn = await rdb_open();
    feeds = await rdb_get_feeds(conn);
  } finally {
    if (conn) {
      conn.close();
    }
  }

  if (title_sort_flag) {
    feeds.sort(feed_compare);
  }

  return feeds;
}

function feed_compare(a, b) {
  const atitle = a.title ? a.title.toLowerCase() : '';
  const btitle = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(atitle, btitle);
}

export async function ral_find_feed_by_id(feed_id) {
  let conn;
  return await reader_db_find_feed_by_id(conn, feed_id);
}

export async function ral_import(channel, files) {
  const fetch_feed_timeout = 10 * 1000;
  let reader_conn, favicon_conn;

  try {
    [reader_conn, favicon_conn] =
        await Promise.all([rdb_open(), favicon_service_open()]);
    await import_opml_impl(
        reader_conn, favicon_conn, channel, fetch_feed_timeout, files);
  } finally {
    if (reader_conn) reader_conn.close();
    if (favicon_conn) favicon_conn.close();
  }
}

export async function ral_export(title) {
  let conn;
  try {
    conn = await rdb_open();
    export_opml_impl(conn, title);
  } finally {
    if (conn) conn.close();
  }
}

export async function ral_load_initial(
    entry_cursor_offset, entry_cursor_limit, entry_handler, feed_handler) {
  let conn;
  try {
    conn = await rdb_open();

    const p1 = rdb_viewable_entries_for_each(
        conn, entry_cursor_offset, entry_cursor_limit, entry_handler);
    const p2 = rdb_for_each_active_feed(conn, feed_handler);

    await Promise.all([p1, p2]);
  } finally {
    if (conn) {
      console.debug('Closing connection', conn.name);
      conn.close();
    }
  }
}

export async function ral_poll_feeds(channel, console) {
  const ctx = {};
  ctx.ignoreRecencyCheck = true;
  ctx.ignoreModifiedCheck = true;
  ctx.console = console;
  ctx.channel = channel;

  let reader_conn, favicon_conn;
  const conn_promises = [rdb_open(), favicon_service_open()];

  try {
    [reader_conn, favicon_conn] = await Promise.all(conn_promises);
    ctx.feedConn = reader_conn;
    ctx.iconConn = favicon_conn;
    await poll_service_poll_feeds(ctx);
  } finally {
    if (reader_conn) {
      reader_conn.close();
    }

    if (favicon_conn) {
      favicon_conn.close();
    }
  }
}

export async function ral_subscribe(channel, url) {
  const ctx = {};
  ctx.channel = channel;
  ctx.notify = true;
  ctx.fetchFeedTimeout = 2000;

  const conn_promises = Promise.all([rdb_open(), favicon_service_open()]);
  let reader_conn, favicon_conn;
  try {
    [reader_conn, favicon_conn] = await conn_promises;
    ctx.feedConn = reader_conn;
    ctx.iconConn = favicon_conn;
    return await subscribe(ctx, url);
  } finally {
    if (reader_conn) {
      console.debug('Closing connection to database', reader_conn.name);
      reader_conn.close();
    }

    if (favicon_conn) {
      console.debug('Closing connection to database', favicon_conn.name);
      favicon_conn.close();
    }
  }
}

export async function ral_unsubscribe(channel, feed_id) {
  let conn;
  try {
    await unsubscribe(conn, channel, feed_id);
  } finally {
    if (conn) {
      conn.close();
    }
  }
}

export async function ral_activate_feed(channel, feed_id) {
  let conn;
  try {
    conn = await rdb_open();
    await rdb_feed_activate(conn, channel, feed_id);
  } finally {
    if (conn) {
      console.debug('Closing connection to database', conn.name);
      conn.close();
    }
  }
}

export async function ral_deactivate_feed(channel, feed_id, reason) {
  let conn;
  try {
    conn = await rdb_open();
    await rdb_feed_deactivate(conn, channel, feed_id, reason);
  } finally {
    if (conn) {
      console.debug('Closing connection to database', conn.name);
      conn.close();
    }
  }
}
