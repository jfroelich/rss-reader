'use strict';

// import base/status.js
// import http/fetch.js
// import poll/poll-entry.js
// import extension.js
// import feed.js
// import feed-coerce-from-response.js
// import reader-db.js
// import reader-storage.js

function poll_feeds_context() {
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
    const state = await extension_idle_query(desc.idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      console.debug('idle');
      return false;
    }
  }

  let feeds;
  try {
    feeds = await reader_db_get_feeds(desc.reader_conn);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  if(!desc.ignore_recency_check) {
    const pollable_feeds = [];
    for(const feed of feeds) {
      if(poll_feeds_feed_is_pollable(feed, desc.recency_period_ms)) {
        pollable_feeds.push(feed);
      }
    }
    feeds = pollable_feeds;
  }

  const promises = [];
  for(const feed of feeds) {
    promises.push(poll_feeds_poll_feed(feed, desc));
  }

  const poll_feed_statuses = await Promise.all(promises);

  let status = await reader_update_badge(desc.reader_conn);
  if(status !== STATUS_OK) {
    console.warn('poll_feeds reader_update_badge failed with status', status);
  }

  const title = 'Added articles';
  const message = 'Added articles';
  extension_notify(title, message);

  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();

  console.log('poll_feeds end');
  return STATUS_OK;
}

function poll_feeds_feed_is_pollable(feed, recency_period_ms) {
  // If we do not know when the feed was fetched, then assume it is a new feed
  // that has never been fetched
  if(!feed.dateFetched) {
    return true;
  }

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recency_period_ms) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    console.debug('feed polled too recently', feed_get_top_url(feed));
    return false;
  }

  return true;
}

// @throws {Error} any exception thrown by fetch_feed
// @returns {status} status
async function poll_feeds_poll_feed(feed, desc) {
  console.assert(feed_is_feed(feed));
  console.assert(desc instanceof poll_feeds_context);

  const url = feed_get_top_url(feed);

  let response;
  try {
    response = await fetch_feed(url, desc.fetch_feed_timeout_ms,
      desc.accept_html);
  } catch(error) {
    console.warn(error);
    return ERR_FETCH;
  }

  // Check whether the feed was not modified since last update
  if(!desc.ignore_modified_check && feed.dateUpdated &&
    feed.dateLastModified && response.last_modified_date &&
    feed.dateLastModified.getTime() ===
    response.last_modified_date.getTime()) {

    console.debug('skipping unmodified feed', url, feed.dateLastModified,
      response.last_modified_date);
    return STATUS_OK;
  }

  const xml_string = await response.text();
  const coerce_result = feed_coerce_from_response(xml_string,
    response.request_url, response.response_url, response.last_modified_date);
  const merged_feed = feed_merge(feed, coerce_result.feed);

  let stored_feed;
  try {
    stored_feed = await reader_storage_put_feed(merged_feed, desc.reader_conn);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  // Cascade feed properties to entires
  for(const entry of coerce_result.entries) {
    entry.feed = stored_feed.id;
    entry.feedTitle = stored_feed.title;
  }

  await poll_feeds_poll_feed_entries(stored_feed, coerce_result.entries, desc);
  return STATUS_OK;
}

function poll_feeds_poll_feed_entries(feed, entries, desc) {
  const pec = new poll_entry_context();
  pec.reader_conn = desc.reader_conn;
  pec.icon_conn = desc.icon_conn;
  pec.feed_favicon_url = feed.faviconURLString;
  pec.fetch_html_timeout_ms = desc.fetch_html_timeout_ms;
  pec.fetch_image_timeout_ms = desc.fetch_image_timeout_ms;

  entries = poll_feeds_filter_dup_entries(entries);
  return Promise.all(entries.map(poll_entry, pec));
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
