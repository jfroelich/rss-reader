import {clear as favicon_service_clear, compact as favicon_service_compact, lookup as favicon_service_lookup, open as favicon_service_open} from '/src/favicon-service/favicon-service.js';
import archive_entries from '/src/feed-ops/archive-entries.js';
import rdb_refresh_feed_icons from '/src/feed-ops/refresh-feed-icons.js';
import entry_store_remove_lost_entries from '/src/feed-ops/remove-lost-entries.js';
import entry_store_remove_orphans from '/src/feed-ops/remove-orphaned-entries.js';
import {poll_service_close_context, poll_service_create_context, poll_service_poll_feeds} from '/src/poll-service/poll-service.js';
import {rdb_open} from '/src/rdb/rdb.js';

const cli = {};

cli.refresh_icons = async function() {
  const [reader_conn, favicon_conn] =
      await Promise.all([rdb_open(), favicon_service_open()]);
  await rdb_refresh_feed_icons(reader_conn, favicon_conn);
  reader_conn.close();
  favicon_conn.close();
};

cli.archive_entries = function(limit) {
  let conn, max_age;
  const channel = new BroadcastChannel('reader');
  archive_entries(conn, channel, max_age).catch(console.error).finally(() => {
    if (channel) {
      channel.close();
    }
  });
};

cli.poll_service_poll_feeds = async function() {
  const context = await poll_service_create_context();
  context.ignoreRecencyCheck = true;
  context.ignoreModifiedCheck = true;
  context.console = console;
  await poll_service_poll_feeds(context);
  poll_service_close_context(context);
};

cli.entry_store_remove_lost_entries = async function(limit) {
  const channel = new BroadcastChannel('reader');
  let conn;
  try {
    await entry_store_remove_lost_entries(conn, channel, console);
  } finally {
    channel.close();
  }
};

cli.entry_store_remove_orphans = async function() {
  const channel = new BroadcastChannel('reader');
  let conn;
  try {
    await entry_store_remove_orphans(conn, channel);
  } finally {
    channel.close();
  }
};

cli.clear_favicons = favicon_service_clear;
cli.compact_favicons = favicon_service_compact;

cli.lookup_favicon = async function(url, cached) {
  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await favicon_service_open();
  }

  const icon_url_string = await favicon_service_lookup(query);
  if (cached) {
    query.conn.close();
  }

  return icon_url_string;
};

window.cli = cli;  // expose to console
