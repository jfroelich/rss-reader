'use strict';

// import poll/poll-entry.js
// import extension.js
// import reader-db.js


function PollFeedsDescriptor() {
  this.reader_conn = undefined;
  this.icon_conn = undefined;
  this.allow_metered_connections = false;
  this.ignore_recency_check = false;
  this.ignore_idle_state = false;
  this.ignore_modified_check = false;
  this.idle_period_secs = 30;
  this.recency_period_ms = 5 * 60 * 1000;
  this.fetch_feed_timeout_ms = 5000;
  this.fetch_html_timeout_ms = 5000;
  this.fetch_image_timeout_ms = 3000;

  // Whether to accept html when fetching a feed
  this.accept_html = true;
}

// TODO: return status instead of counts

async function poll_feeds(desc) {
  console.log('poll_feeds start');

  if('onLine' in navigator && !navigator.onLine) {
    console.debug('offline');
    return false;
  }

  if(!desc.allow_metered_connections && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    console.debug('metered connection');
    return false;
  }

  if(!desc.ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await extension_idle_query(idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      console.log('Polling canceled because machine not idle');
      return false;
    }
  }

  // Allow exceptions to bubble (for now)
  const feeds = await poll_feeds_find_pollable_feeds(desc);

  const promises = [];
  for(const feed of feeds) {
    promises.push(poll_feeds_poll_feed_silently(feed, desc));
  }
  const resolutions = await Promise.all(promises);

  let num_entries_added = 0;
  for(const resolution of resolutions) {
    num_entries_added += resolution;
  }

  // Non-awaited, this uses its own conn
  if(num_entries_added) {
    extension_update_badge_text();
  }

  if(num_entries_added) {
    poll_feeds_show_poll_notification(num_entries_added);
  }

  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();

  console.log('Polling completed');
  return num_entries_added;
}


async function poll_feeds_find_pollable_feeds(desc) {
  const feeds = await reader_db_get_feeds(desc.reader_conn);
  if(desc.ignore_recency_check) {
    return feeds;
  }

  const output_feeds = [];
  for(const feed of feeds) {
    if(poll_feeds_feed_is_pollable(feed, desc.recency_period_ms)) {
      output_feeds.push(feed);
    }
  }
  return output_feeds;
}

function poll_feeds_show_poll_notification(num_entries_added) {
  const title = 'Added articles';
  const message = `Added ${num_entries_added} articles`;
  extension_notify(title, message);
}

function poll_feeds_feed_is_pollable(feed, recency_period_ms) {
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
    console.log('feed polled too recently', feed_get_top_url(feed));
    return false;
  }

  return true;
}


async function poll_feeds_poll_feed_silently(feed, desc) {
  let num_entries_added = 0;
  try {
    num_entries_added = await poll_feeds_poll_feed(feed, desc);
  } catch(error) {
    console.warn(error);
  }
  return num_entries_added;
}

// @throws {Error} any exception thrown by fetch_feed
async function poll_feeds_poll_feed(local_feed, desc) {
  console.assert(feed_is_feed(local_feed));

  const url = feed_get_top_url(local_feed);

  const response = await fetch_feed(url, desc.fetch_feed_timeout_ms,
    desc.accept_html);

  // Before parsing, check if the feed was modified
  if(!desc.ignore_modified_check && local_feed.dateUpdated &&
    poll_feeds_is_feed_unmodified(local_feed.dateLastModified,
      response.last_modified_date)) {
    console.log('skipping unmodified feed', url,
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

  await reader_db_put_feed(desc.reader_conn, storable_feed);

  const resolutions = await poll_feeds_poll_feed_entries(desc.reader_conn,
    desc.icon_conn, storable_feed, parse_feed_result.entries,
    desc.fetch_html_timeout_ms,
    desc.fetch_image_timeout_ms);

  let num_entries_added = 0;
  for(const resolution of resolutions) {
    if(resolution) {
      num_entries_added++;
    }
  }
  return num_entries_added;
}

function poll_feeds_poll_feed_entries(reader_conn, icon_conn, feed, entries,
  fetch_html_timeout_ms, fetch_img_timeout_ms) {
  entries = poll_feeds_filter_dup_entries(entries);

  // Cascade feed properties
  for(const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
  }

  const promises = [];
  for(const entry of entries) {
    // poll_entry is not 'thread-safe' in the sense that we must use a separate
    // descriptor for each call.
    const ped = new PollEntryDescriptor();
    ped.reader_conn = reader_conn;
    ped.icon_conn = icon_conn;
    ped.feed_favicon_url = feed.faviconURLString;
    ped.fetch_html_timeout_ms = fetch_html_timeout_ms;
    ped.fetch_image_timeout_ms = fetch_img_timeout_ms;
    ped.entry = entry;
    promises.push(poll_entry(ped));
  }
  return Promise.all(promises);
}

function poll_feeds_is_feed_unmodified(local_modified_date, remote_modified_date) {
  return local_modified_date && remote_modified_date &&
    local_modified_date.getTime() === remote_modified_date.getTime();
}

function poll_feeds_filter_dup_entries(entries) {
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
