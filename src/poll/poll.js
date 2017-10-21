'use strict';

(function(exports) {

const POLL_FEEDS_FLAGS = {};
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

  DEBUG('Checking for new articles...');

  // TODO: it would make more sense to just pass flags here
  if(!await is_poll_startable(allow_metered_connections, ignore_idle_state,
    idle_period_secs))
    return;

  let num_entries_added = 0;
  let reader_conn, icon_conn;

  try {
    const conns = await Promise.all([reader_db_open(), favicon_open_db()]);
    reader_conn = conns[0];
    icon_conn = conns[1];
    const feeds = await find_pollable_feeds(reader_conn,
      ignore_recency_check, recency_period_ms);
    const resolutions = await process_feeds(reader_conn, icon_conn, feeds,
      ignore_modified_check, fetch_feed_timeout_ms, fetch_html_timeout_ms,
      fetch_img_timeout_ms);

    // TODO: this can occur outside of the try/catch
    for(const resolution of resolutions)
      num_entries_added += resolution;


  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  // Non-awaited, this uses its own conn
  if(num_entries_added)
    extension_update_badge_text();

  if(num_entries_added)
    show_poll_notification(num_entries_added);
  broadcast_poll_completed_message(num_entries_added);
  DEBUG('Polling completed');
  return num_entries_added;
}

// TODO: inline this function
async function is_poll_startable(allow_metered_connections, ignore_idle_state,
  idle_period_secs) {
  if(is_offline()) {
    DEBUG('Polling canceled because offline');
    return false;
  }

  if(!allow_metered_connections && 'NO_POLL_METERED' in localStorage &&
    is_metered_connection()) {
    DEBUG('Polling canceled because connection is metered');
    return false;
  }

  if(!ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await extension_idle_query(idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      DEBUG('Polling canceled because machine not idle');
      return false;
    }
  }

  return true;
}

// TODO: should just accept flags variable?
async function find_pollable_feeds(reader_conn, ignore_recency_check,
  recency_period_ms) {
  const feeds = await reader_db_get_feeds(reader_conn);
  if(ignore_recency_check)
    return feeds;
  const output_feeds = [];
  for(const feed of feeds)
    if(feed_is_pollable(feed, recency_period_ms))
      output_feeds.push(feed);
  return output_feeds;
}

function show_poll_notification(num_entries_added) {
  const title = 'Added articles';
  const message = `Added ${num_entries_added} articles`;
  extension_notify(title, message);
}

function feed_is_pollable(feed, recency_period_ms) {
  // If we do not know when the feed was fetched, then assume it is a new feed
  // that has never been fetched, so pollable
  if(!feed.dateFetched)
    return true;

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recency_period_ms) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    DEBUG('feed polled too recently', feed_get_top_url(feed));
    return false;
  }

  return true;
}

function process_feeds(reader_conn, icon_conn, feeds, ignore_modified_check,
  fetch_feed_timeout_ms, fetch_html_timeout_ms, fetch_img_timeout_ms) {
  const promises = [];
  for(const feed of feeds) {
    const promise = poll_feed_silently(reader_conn, icon_conn, feed,
      fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
      fetch_img_timeout_ms);
    promises.push(promise);
  }
  return Promise.all(promises);
}

async function poll_feed_silently(reader_conn, icon_conn, feed,
  fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
  fetch_img_timeout_ms) {
  let num_entries_added = 0;
  try {
    num_entries_added = await poll_feed(reader_conn, icon_conn, feed,
      fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
      fetch_img_timeout_ms);
  } catch(error) {
    DEBUG(error);
  }
  return num_entries_added;
}

// @throws {Error} any exception thrown by fetch_feed is rethrown
// TODO: move to poll-feed.js
async function poll_feed(reader_conn, icon_conn, local_feed,
  fetch_feed_timeout_ms, ignore_modified_check, fetch_html_timeout_ms,
  fetch_img_timeout_ms) {

  ASSERT(local_feed);

  const url_string = feed_get_top_url(local_feed);
  const accept_html = true;

  // Allow exceptions to bubble
  const response = await fetch_feed(url_string, fetch_feed_timeout_ms,
    accept_html);

  // Before parsing, check if the feed was modified
  if(!ignore_modified_check && local_feed.dateUpdated &&
    is_feed_unmodified(local_feed.dateLastModified,
      response.last_modified_date)) {
    DEBUG('skipping unmodified feed', url_string,
        local_feed.dateLastModified, response.last_modified_date);
    return 0;
  }

  // TODO: provide an option to do a crc32 check for whether feed content
  // has changed instead of relying on date modified header, because date
  // modified header may not be trustworthy?

  // Now that we know the feed has been modified according to its header,
  // fetch and parse the body of the response into a feed object
  // Must be awaited because internally parse_fetched_feed fetches the body
  // of the response
  const parse_feed_result = await parse_fetched_feed(response);

  const merged_feed = feed_merge(local_feed, parse_feed_result.feed);

  // Prepare the feed for storage
  let storable_feed = feed_sanitize(merged_feed);
  storable_feed = object_filter_empty_props(storable_feed);
  storable_feed.dateUpdated = new Date();

  await reader_db_put_feed(reader_conn, storable_feed);

  const resolutions = await poll_feed_entries(reader_conn, icon_conn,
    storable_feed, parse_feed_result.entries, fetch_html_timeout_ms,
    fetch_img_timeout_ms);

  let num_entries_added = 0;
  for(const resolution of resolutions) {
    if(resolution)
      num_entries_added++;
  }
  return num_entries_added;
}

// TODO: this should call out to poll_entry_silently to avoid the
// failfast behavior of Promise.all
function poll_feed_entries(reader_conn, icon_conn, feed, entries,
  fetch_html_timeout_ms, fetch_img_timeout_ms) {
  entries = filter_dup_entries(entries);
  const promises = [];
  for(const entry of entries) {
    const promise = poll_entry(entry, reader_conn, icon_conn, feed,
      fetch_html_timeout_ms, fetch_img_timeout_ms);
    promises.push(promise);
  }
  return Promise.all(promises);
}

function is_feed_unmodified(local_modified_date, remote_modified_date) {
  return local_modified_date && remote_modified_date &&
    local_modified_date.getTime() === remote_modified_date.getTime();
}

function filter_dup_entries(entries) {
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

// experimental
// TODO: inline
function is_metered_connection() {
  return navigator.connection && navigator.connection.metered;
}

// TODO: inline
function is_offline() {
  return 'onLine' in navigator && !navigator.onLine;
}

function broadcast_poll_completed_message(num_entries_added) {
  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();
}

exports.poll_feeds = poll_feeds;
exports.POLL_FEEDS_FLAGS = POLL_FEEDS_FLAGS;

}(this));
