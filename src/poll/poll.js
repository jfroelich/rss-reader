// See license.md
'use strict';

{ // Begin file block scope

const POLL_FEEDS_FLAGS = {};
POLL_FEEDS_FLAGS.VERBOSE = 1; // 1
POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS = 2; // 10
POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK = 4; // 100
POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE = 8; // 1000
POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK = 16; // 10000

async function poll_feeds(idle_period_secs, recency_period_ms,
  fetch_feed_timeout_ms, fetch_html_timeout_ms, fetch_img_timeout_ms, flags) {
  if(typeof idle_period_secs === 'undefined')
    idle_period_secs = 30;
  if(typeof recency_period_ms === 'undefined')
    recency_period_ms = 5 * 60 * 1000;
  if(typeof fetch_feed_timeout_ms === 'undefined')
    fetch_feed_timeout_ms = 5000;
  if(typeof fetch_html_timeout_ms === 'undefined')
    fetch_html_timeout_ms = 5000;
  if(typeof fetch_img_timeout_ms === 'undefined')
    fetch_img_timeout_ms = 3000;
  if(typeof flags === 'undefined')
    flags = 0;

  const allow_metered_connections = flags &
    POLL_FEEDS_FLAGS.ALLOW_METERED_CONNECTIONS;
  const ignore_idle_state = flags & POLL_FEEDS_FLAGS.IGNORE_IDLE_STATE;
  const ignore_recency_check = flags & POLL_FEEDS_FLAGS.IGNORE_RECENCY_CHECK;
  const ignore_modified_check = flags & POLL_FEEDS_FLAGS.IGNORE_MODIFIED_CHECK;
  const verbose = flags & POLL_FEEDS_FLAGS.VERBOSE;

  if(verbose)
    console.log('Checking for new articles...');

  // TODO: it would make more sense to just pass flags here
  if(!await is_poll_startable(allow_metered_connections, ignore_idle_state,
    idle_period_secs, verbose))
    return;

  let num_entries_added = 0;

  // TODO: these should probably be parameters to poll_feeds
  let icon_db_name, icon_db_version, conn_timeout_ms;
  let reader_db_name, reader_db_version;

  const reader_open_promise = reader_open_db(reader_db_name, reader_db_version,
    conn_timeout_ms, verbose);
  const icon_open_promise = favicon_open_db(icon_db_name, icon_db_version,
    conn_timeout_ms, verbose);
  const open_promises = [reader_open_promise, icon_open_promise];
  let reader_conn, icon_conn;

  try {
    const conns = await Promise.all(open_promises);
    reader_conn = conns[0];
    icon_conn = conns[1];
    const feeds = await db_find_pollable_feeds(reader_conn,
      ignore_recency_check, recency_period_ms, verbose);
    num_entries_added = await process_feeds(reader_conn, icon_conn, feeds,
      ignore_modified_check, fetch_feed_timeout_ms, fetch_html_timeout_ms,
      fetch_img_timeout_ms, verbose);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  // Non-awaited, this uses its own conn
  if(num_entries_added)
    ext_update_badge(verbose).catch(console.warn);

  if(num_entries_added)
    show_poll_notification(num_entries_added);
  broadcast_poll_completed_message(num_entries_added);
  if(verbose)
    console.log('Polling completed');
  return num_entries_added;
}

async function is_poll_startable(allow_metered_connections, ignore_idle_state,
  idle_period_secs, verbose) {
  if(is_offline()) {
    if(verbose)
      console.warn('Polling canceled because offline');
    return false;
  }

  if(!allow_metered_connections && 'NO_POLL_METERED' in localStorage &&
    is_metered_connection()) {
    if(verbose)
      console.warn('Polling canceled because connection is metered');
    return false;
  }

  if(!ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await query_idle_state(idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      if(verbose)
        console.warn('Polling canceled because machine not idle');
      return false;
    }
  }

  return true;
}

function db_load_feeds(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

// TODO: should just accept flags variable
async function db_find_pollable_feeds(reader_conn, ignore_recency_check,
  recency_period_ms, verbose) {
  const feeds = await db_load_feeds(reader_conn);
  if(ignore_recency_check)
    return feeds;
  const output_feeds = [];
  for(const feed of feeds)
    if(is_pollable_feed(feed, recency_period_ms, verbose))
      output_feeds.push(feed);
  return output_feeds;
}

function show_poll_notification(num_entries_added) {
  const title = 'Added articles';
  const message = `Added ${num_entries_added} articles`;
  ext_show_notification(title, message);
}

function is_pollable_feed(feed, recency_period_ms, verbose) {
  // If we do not know when the feed was fetched, then assume it is a new feed
  // that has never been fetched. In this case, consider the feed to be
  // eligible
  if(!feed.dateFetched)
    return true;

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recency_period_ms) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    if(verbose)
      console.debug('Feed polled too recently',
        Feed.prototype.get_url.call(feed));
    // In this case we do not want to poll the feed
    return false;
  } else
    return true;// Otherwise we do want to poll the feed
}

async function process_feeds(reader_conn, icon_conn, feeds,
  ignore_modified_check, fetch_feed_timeout_ms, fetch_html_timeout_ms,
  fetch_img_timeout_ms, verbose) {
  const promises = [];
  for(const feed of feeds) {
    const promise = poll_feed_silently(reader_conn, icon_conn, feed,
      fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
      fetch_img_timeout_ms, verbose);
    promises.push(promise);
  }

  const resolutions = await Promise.all(promises);
  let total_entries_added = 0;
  for(const num_entries_added of resolutions)
    total_entries_added += num_entries_added;
  return total_entries_added;
}

async function poll_feed_silently(reader_conn, icon_conn, feed,
  fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
  fetch_img_timeout_ms, verbose) {
  let num_entries_added = 0;
  try {
    num_entries_added = await poll_feed(reader_conn, icon_conn, feed,
      fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
      fetch_img_timeout_ms, verbose);
  } catch(error) {
    if(verbose)
      console.warn(error);
  }
  return num_entries_added;
}

// @throws {Error} any exception thrown by fetch_feed is rethrown
async function poll_feed(reader_conn, icon_conn, local_feed,
  fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
  fetch_img_timeout_ms, verbose) {
  if(typeof local_feed === 'undefined')
    throw new TypeError('local_feed is undefined');

  const url_string = Feed.prototype.get_url.call(local_feed);
  const timeout_ms = fetch_feed_timeout_ms;
  const is_accept_html = true;

  const response = await fetch_feed(url_string, timeout_ms, is_accept_html);

  // Before parsing, check if the feed was modified
  if(!ignore_modified_check && local_feed.dateUpdated &&
    is_feed_unmodified(local_feed.dateLastModified,
      response.lastModifiedDate)) {
    if(verbose)
      console.debug('Skipping unmodified feed', url_string,
        local_feed.dateLastModified, response.lastModifiedDate);
    return 0;
  }

  const parse_feed_result = parse_fetched_feed(response);
  const merged_feed = merge_feeds(local_feed, parse_feed_result.feed);
  let storable_feed = Feed.prototype.sanitize.call(merged_feed);
  storable_feed = filter_empty_props(storable_feed);
  storable_feed.dateUpdated = new Date();
  await db_put_feed(reader_conn, storable_feed);

  const num_entries_added = await poll_feed_entries(reader_conn, icon_conn,
    storable_feed, parse_feed_result.entries, fetch_html_timeout_ms,
    fetch_img_timeout_ms, verbose);
  return num_entries_added;
}

// Adds or overwrites a feed in storage. Resolves with the new feed id if add.
// There are no side effects other than the database modification.
// @param conn {IDBDatabase} an open database connection
// @param feed {Object} the feed object to add
function db_put_feed(conn, feed) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

async function poll_feed_entries(reader_conn, icon_conn, feed, entries,
  fetch_html_timeout_ms, fetch_img_timeout_ms, verbose) {
  entries = filter_dup_entries(entries);
  const promises = [];
  for(const entry of entries) {
    const promise = poll_entry(reader_conn, icon_conn, feed, entry,
      fetch_html_timeout_ms, fetch_img_timeout_ms, verbose);
    promises.push(promise);
  }

  const resolutions = await Promise.all(promises);
  let num_entries_added = 0;
  for(const resolution of resolutions) {
    if(resolution)
      num_entries_added++;
  }
  return num_entries_added;
}

function is_feed_unmodified(local_modified_date, remote_modified_date) {
  return local_modified_date && remote_modified_date &&
    local_modified_date.getTime() === remote_modified_date.getTime();
}

function filter_dup_entries(entries) {
  // TODO: use a Set?
  const distinct_entries = [];
  const seen_urls = [];

  for(const entry of entries) {
    let is_seen_url = false;
    for(const url_string of entry.urls) {
      if(seen_urls.includes(url_string)) {
        is_seen_url = true;
        break;
      }
    }

    if(!is_seen_url) {
      distinct_entries.push(entry);
      seen_urls.push(...entry.urls);
    }
  }

  return distinct_entries;
}

function query_idle_state(idle_period_secs) {
  function resolver(resolve) {
    chrome.idle.queryState(idle_period_secs, resolve);
  }
  return new Promise(resolver);
}

// experimental
function is_metered_connection() {
  return navigator.connection && navigator.connection.metered;
}

function is_offline() {
  return 'onLine' in navigator && !navigator.onLine;
}

function broadcast_poll_completed_message(num_entries_added) {
  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();
}

this.poll_feeds = poll_feeds;
this.POLL_FEEDS_FLAGS = POLL_FEEDS_FLAGS;

} // End file block scope
