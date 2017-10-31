'use strict';

// import base/errors.js
// import net/fetch.js
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

async function poll_feeds(pfc) {
  console.log('poll_feeds start');

  if('onLine' in navigator && !navigator.onLine) {
    console.debug('offline');
    return false;
  }

  if(!pfc.allow_metered_connections && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    console.debug('metered connection');
    return false;
  }

  if(!pfc.ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await extension_idle_query(pfc.idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      console.debug('idle');
      return false;
    }
  }

  let feeds;
  try {
    feeds = await reader_db_get_feeds(pfc.reader_conn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  if(!pfc.ignore_recency_check) {
    const pollable_feeds = [];
    for(const feed of feeds) {
      if(poll_feeds_feed_is_pollable(feed, pfc.recency_period_ms)) {
        pollable_feeds.push(feed);
      }
    }
    feeds = pollable_feeds;
  }

  const promises = [];
  for(const feed of feeds) {
    promises.push(poll_feeds_poll_feed(feed, pfc));
  }

  const poll_feed_statuses = await Promise.all(promises);

  let status = await reader_update_badge(pfc.reader_conn);
  if(status !== RDR_OK) {
    console.warn('poll_feeds reader_update_badge failed with status', status);
  }

  const title = 'Added articles';
  const message = 'Added articles';
  extension_notify(title, message);

  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();

  console.log('poll_feeds end');
  return RDR_OK;
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
async function poll_feeds_poll_feed(feed, pfc) {
  console.assert(feed_is_feed(feed));
  console.assert(pfc instanceof poll_feeds_context);

  const url = feed_get_top_url(feed);

  let response;
  try {
    response = await fetch_feed(url, pfc.fetch_feed_timeout_ms,
      pfc.accept_html);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_FETCH;
  }

  // Check whether the feed was not modified since last update
  if(!pfc.ignore_modified_check && feed.dateUpdated &&
    feed.dateLastModified && response.last_modified_date &&
    feed.dateLastModified.getTime() ===
    response.last_modified_date.getTime()) {

    console.debug('skipping unmodified feed', url, feed.dateLastModified,
      response.last_modified_date);
    return RDR_OK;
  }

  let xml_string;
  try {
    xml_string = await response.text();
  } catch(error) {
    console.warn(error);
    return RDR_ERR_FETCH;
  }

  let parse_result;
  try {
    parse_result = feed_parse_from_string(xml_string);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_PARSE;
  }

  const coerced_feed = coerce_fetched_feed(parse_result.feed, url,
    response.response_url, response.last_modified_date);

  const merged_feed = feed_merge(feed, coerced_feed);
  let stored_feed;
  try {
    stored_feed = await reader_storage_put_feed(merged_feed, pfc.reader_conn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  let entries = parse_result.entries;

  let base_url;
  try {
    base_url = new URL(feed.link);
  } catch(error) {
    // Ignore? I guess? Ignore for now. Might be incorrect.
  }

  for(const entry of entries) {
    canonicalize_fetched_entry_link(entry, base_url);
  }

  for(const entry of entries) {
    coerce_fetched_entry_to_storage_format(entry);
  }

  entries = poll_feeds_filter_dup_entries(entries);

  // Cascade feed properties to entries
  for(const entry of entries) {
    entry.feed = stored_feed.id;
    entry.feedTitle = stored_feed.title;
    if(!entry.datePublished) {
      entry.datePublished = stored_feed.datePublished;
    }
  }

  const pec = new poll_entry_context();
  pec.reader_conn = pfc.reader_conn;
  pec.icon_conn = pfc.icon_conn;
  pec.feed_favicon_url = stored_feed.faviconURLString;
  pec.fetch_html_timeout_ms = pfc.fetch_html_timeout_ms;
  pec.fetch_image_timeout_ms = pfc.fetch_image_timeout_ms;

  const entry_promises = entries.map(poll_entry, pec);
  const entry_resolutions = await Promise.all(entry_promises);
  return RDR_OK;
}

function poll_feeds_filter_dup_entries(entries) {
  const distinct_entries = [];
  const seen_urls = [];

  for(const entry of entries) {

    // Retain entries without urls in the output without comparison
    if(!entry_has_url(entry)) {
      distinct_entries.push(entry);
      continue;
    }

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
