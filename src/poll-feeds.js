// See license.md

'use strict';

// TODO: use a single favicon cache connection for favicon lookups
// TODO: add is-active feed functionality, do not poll in-active feeds
// TODO: deactivate unreachable feeds after x failures
// TODO: deactivate feeds not changed for a long time
// TODO: store deactivation reason in feed
// TODO: store deactivation date

// TODO: maybe I should have a crawler module, put all the fetch things
// into it, then move this into the module. This would maybe properly
// aggregate functionality together

{

function poll_feeds(force_reset_lock, ignore_idle_state, allow_metered,
  skip_unmodified_guard, log) {
  log.log('Checking for new articles...');
  const ctx = {
    'num_feeds_pending': 0,
    'log': log,
    'skip_unmodified_guard': skip_unmodified_guard
  };

  if(!acquire_lock.call(ctx, force_reset_lock)) {
    log.warn('Poll is locked');
    on_complete.call(ctx);
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    log.warn('Canceling poll as offline');
    on_complete.call(ctx);
    return;
  }

  // This is experimental
  if(!allow_metered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    log.debug('Canceling poll as on metered connection');
    on_complete.call(ctx);
    return;
  }

  if(!ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const idle_period_secs = 30;
    query_idle_state(idle_period_secs).then(on_query_idle_state.bind(ctx));
  } else {
    db_connect(undefined, log).then(connect_on_success.bind(ctx)).catch(
      connect_on_error.bind(ctx));
  }
}

function query_idle_state(idle_period_secs, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Checking idle state with idle period (in seconds)',
      idle_period_secs);
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

function on_query_idle_state(state) {
  this.log.debug('idle state:', state);
  if(state === 'locked' || state === 'idle') {
    db_connect(undefined, this.log).then(connect_on_success.bind(this)).catch(
      connect_on_error.bind(this));
  } else {
    on_complete.call(this);
  }
}

function connect_on_success(conn) {
  this.conn = conn;
  db_get_all_feeds(this.log, conn, on_get_feeds.bind(this));
}

function connect_on_error(error) {
  on_complete.call(this);
}

function on_get_feeds(feeds) {
  if(!feeds.length) {
    on_complete.call(this);
    return;
  }

  this.num_feeds_pending = feeds.length;

  // So this won't really work like before, I guess I need to use
  // Promise.all

  for(let feed of feeds) {
    const url = new URL(get_feed_url(feed));
    fetch_feed(url, false, this.log).then(
      on_fetch_feed.bind(this, feed)).catch(
      fetch_feed_on_error.bind(this));
  }
}

function fetch_feed_on_error(error) {
  this.log.debug(error);
  this.num_feeds_pending--;
  on_complete.call(this);
}

function on_fetch_feed(local_feed, fetch_output) {
  const remote_feed = fetch_output.feed;

  // If the feed has updated in the past, then check if it has been modified.
  // dateUpdated is not set for newly added feeds, so checking it avoids the
  // case where a newly subscribed feed is skipped because it was not modified
  // from the time of the inital subscribe.
  if(!this.skip_unmodified_guard && local_feed.dateUpdated &&
    is_feed_unmodified(local_feed, remote_feed)) {
    this.log.debug('Feed not modified', get_feed_url(remote_feed));
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  const feed = merge_feeds(local_feed, remote_feed);
  db_update_feed(this.log, this.conn, feed,
    on_update_feed.bind(this, fetch_output.entries));
}

function is_feed_unmodified(local_feed, remote_feed) {
  return local_feed.dateLastModified && remote_feed.dateLastModified &&
    local_feed.dateLastModified.getTime() ===
    remote_feed.dateLastModified.getTime()
}

function on_update_feed(entries, event) {
  // If we failed to update the feed, then do not even bother updating its
  // entries. Something is seriously wrong. Perhaps this should even be a
  // fatal error.
  if(event.type !== 'success') {
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  if(!entries.length) {
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  // TODO: filter out entries without urls, and then check again against num
  // remaining.
  // TODO: I should be filtering duplicate entries, compared by norm url,
  // somewhere. I somehow lost this functionality, or moved it somewhere

  // TODO: instead of passing along the feed, just shove it in feed ctx
  // and pass along feed ctx instead
  // or just pass along only the relevant fields needed like feedId and title
  // and faviconURLString
  const feed_ctx = {
    'num_entries_processed': 0,
    'num_entries_added': 0,
    'num_entries': entries.length
  };

  const bound_on_entry_processed = on_entry_processed.bind(this, feed_ctx);
  for(let entry of entries) {
    process_entry.call(this, event.feed, entry, bound_on_entry_processed);
  }
}

function process_entry(feed, entry, callback) {
  const url = get_entry_url(entry);
  if(!url) {
    this.log.warn('Entry missing url', entry);
    callback();
    return;
  }

  const rewritten_url = rewrite_url(new URL(url));
  if(rewritten_url)
    add_entry_url(entry, rewritten_url.href);
  const limit = 1;
  db_find_entry(this.log, this.conn, entry.urls, limit,
    on_find_entry.bind(this, feed, entry, callback));
}

function on_find_entry(feed, entry, callback, matches) {
  if(matches.length) {
    callback();
    return;
  }

  entry.feed = feed.id;

  // TODO: I should be looking up the entry's own favicon
  if(feed.faviconURLString)
    entry.faviconURLString = feed.faviconURLString;

  if(feed.title)
    entry.feedTitle = feed.title;

  const url = new URL(get_entry_url(entry));
  if(is_interstitial_url(url)) {
    entry.content =
      'This content for this article is blocked by an advertisement.';
    prep_local_doc(entry);
    db_add_entry(this.log, this.conn, entry, callback);
    return;
  }

  if(is_script_generated_content(url)) {
    entry.content = 'The content for this article cannot be viewed because ' +
      'it is dynamically generated.';
    prep_local_doc(entry);
    db_add_entry(this.log, this.conn, entry, callback);
    return;
  }

  if(is_paywall_url(url)) {
    entry.content = 'This content for this article is behind a paywall.';
    prep_local_doc(entry);
    db_add_entry(this.log, this.conn, entry, callback);
    return;
  }

  if(is_requires_cookies_url(url)) {
    entry.content = 'This content for this article cannot be viewed because ' +
      'the website requires tracking information.';
    prep_local_doc(entry);
    db_add_entry(this.log, this.conn, entry, callback);
    return;
  }

  if(MimeUtils.is_non_html_url(url)) {
    entry.content = 'This article is not a basic web page (e.g. a PDF).';
    prep_local_doc(entry);
    db_add_entry(this.log, this.conn, entry, callback);
    return;
  }

  fetch_html(url, this.log, on_fetch_entry.bind(this, entry, callback));
}

function on_fetch_entry(entry, callback, event) {
  if(event.type !== 'success') {
    prep_local_doc(entry);
    db_add_entry(this.log, this.conn, entry, callback);
    return;
  }

  const response_url_str = event.responseURL.href;
  if(!response_url_str)
    throw new Error();
  add_entry_url(entry, response_url_str);

  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its faviconURL.
  // TODO: actually maybe this should be happening whether we fetch or not
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const doc = event.document;
  transform_lazy_images(doc);
  filter_sourceless_images(doc);
  filter_invalid_anchors(doc);
  resolve_doc(doc, this.log, event.responseURL);
  filter_tracking_images(doc);
  set_image_dimensions(doc, this.log,
    on_set_image_dimensions.bind(this, entry, doc, callback));
}

function on_set_image_dimensions(entry, doc, callback, num_modified) {
  prep_doc(doc);
  entry.content = doc.documentElement.outerHTML.trim();
  db_add_entry(this.log, this.conn, entry, callback);
}

function prep_doc(doc) {
  filter_boilerplate(doc);
  scrub_dom(doc);
  add_no_referrer(doc);
}

function prep_local_doc(entry) {
  if(!entry.content)
    return;
  const parser = new DOMParser();
  try {
    const doc = parser.parseFromString(entry.content, 'text/html');
    if(doc.querySelector('parsererror')) {
      entry.content = 'Cannot show document due to parsing error';
      return;
    }

    prep_doc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
  } catch(error) {
  }
}

function on_entry_processed(feed_ctx, event) {
  feed_ctx.num_entries_processed++;
  const count = feed_ctx.num_entries_processed;
  if(count > feed_ctx.num_entries)
    throw new Error(`count ${count} > num_entries ${num_entries}`);
  if(event && event.type === 'success')
    feed_ctx.num_entries_added++;
  if(count === feed_ctx.num_entries) {
    if(feed_ctx.num_entries_added)
      update_badge(this.conn, this.log);
    this.num_feeds_pending--;
    on_complete.call(this);
  }
}

function on_complete() {
  if(this.num_feeds_pending)
    return;
  this.log.log('Polling completed');

  const pollChannel = new BroadcastChannel('poll');
  pollChannel.postMessage('completed');
  pollChannel.close();

  show_notification('Updated articles', 'Completed checking for new articles');
  if(this.conn)
    this.conn.close();
  release_lock.call(this);
}

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which resets the value of a global variable.
function acquire_lock(force_reset_lock) {
  if(force_reset_lock)
    release_lock.call(this);
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    this.log.debug('Failed to acquire lock, the lock is already present');
    return false;
  }
  this.log.debug('Acquiring poll lock');
  localStorage.POLL_FEEDS_ACTIVE = '1';
  return true;
}

function release_lock() {
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    this.log.debug('Releasing poll lock');
    delete localStorage.POLL_FEEDS_ACTIVE;
  }
}

this.poll_feeds = poll_feeds;

}
