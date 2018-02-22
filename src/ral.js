import {export_opml as export_opml_impl, import_opml as import_opml_impl} from '/src/exim.js';
import {open as favicon_service_open} from '/src/favicon-service/favicon-service.js';
import subscribe from '/src/feed-ops/subscribe.js';
import unsubscribe from '/src/feed-ops/unsubscribe.js';
import {poll_service_poll_feeds} from '/src/feed-poll/poll-feeds.js';
import {rdb_feed_activate, rdb_feed_deactivate, rdb_for_each_active_feed, rdb_get_feeds, rdb_open, rdb_viewable_entries_for_each} from '/src/rdb.js';

// Resource acquisition layer (RAL). An intermediate layer between storage and
// the view that helps calls acquire and release needed resources, and supplies
// some default values. The goal is to generally boil down calls from the view
// to simple function calls against a simple api, and abstract away the need to
// open and close databases and setup other values. The functions in this layer
// implicitly connect to databases using the app's default settings. Therefore
// these functions are not easily testable, and the calls that have been wrapped
// should be tested instead, because those calls accept an open database
// connection as input, which allows for using a mock database.


// TODO: move this comment to a github issue
// TODO: originally I had a title index in the database, and loaded the feeds
// in sorted order. That caused a big problem, because indexedDB does not
// index missing values, so the result excluded untitled feeds. So now I sort
// in memory after load. However, I'd still like to think about how to do this
// more quickly. One idea is that I store a sort-key property per feed in the
// feed store. I guarantee the property always has a value when storing a
// feed. Each time the feed is updated, and when the feed is created, the
// property is derived from title, and it also normalizes the title (e.g.
// toLowerCase). Then I can create an index on that property, and let
// indexedDB do the sorting implicitly, and quickly, and more efficiently.
// At the moment, this isn't urgent.
// A second component of the the decision is that it would support a for_each
// approach. Right now I am forced to fully buffer all feeds into an array
// first in order to sort. If a let the db do the work I could use a callback
// as each feed is loaded.

// Load all feeds from the database as an array of feed objects. This is
// basically a wrapper to rdb_get_feeds that manages opening and closing
// the database, and sorting the resulting collection by feed title.
// @param title_sort_flag {Boolean} if true, the array is sorted by feed title.
// If false, the array is naturally ordered based on database order
// @throws {Error} database errors
// @return {Array} an array of basic feed objects
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
  // TODO: open the conn here, remove the auto-conn ability from
  // reader_db_find_feed_by_id
  let conn;
  return await reader_db_find_feed_by_id(conn, feed_id);
}

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
        await Promise.all([rdb_open(), favicon_service_open()]);
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
    conn = await rdb_open();
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

// Subscribe to the feed at the given url. This is a wrapper to subscribe
// that automates opening and closing databases and setting some default
// subscription process options.
// @param channel {BroadcastChannel} optional, an open channel that will receive
// messages about storage events like the feed being added to the database
// @param url {URL} the url of a feed
// @throws {Error} subscription errors, database errors, fetch errors, etc
// @return {Object} returns the feed object that was stored in the database
// if successful
export async function ral_subscribe(channel, url) {
  const ctx = {};
  ctx.channel = channel;

  // This is not intended to be a batch call. Regardless of the default setting
  // for subscribe, be explicit that we desire a single notification in this
  // situation
  ctx.notify = true;

  // This is in response to user manually pressing a subscribe button. This is
  // a guess as to the approximate maximum of a time a user will wait before
  // becoming frustrated with app responsiveness, regardless of network
  // conditions. This is hardcoded here for convenience.
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
