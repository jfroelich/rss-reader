// See license.md

'use strict';

// TODO: move tracking back into this file
// TODO: use a single favicon cache connection for favicon lookups
// TODO: add is-active feed functionality, do not poll in-active feeds
// TODO: deactivate unreachable feeds after x failures
// TODO: deactivate feeds not changed for a long time
// TODO: store deactivation reason in feed
// TODO: store deactivation date
// TODO: maybe I should have a crawler module, put all the fetch things
// into it, then move this into the module. This would maybe properly
// aggregate functionality together

// TODO: after fetching feed, feed update is awaited, which blocks the
// poll_feed promise from resolving, when in fact I am not sure it needs
// to do that. I think fetching and updating are separate things that can
// occur concurrently. Rather, updating has to happen after fetching, but it
// does not need to happen before doing other work like processing entries

function poll_feeds(options = {}) {
  return new Promise(poll_feeds_impl.bind(undefined, options));
}

async function poll_feeds_impl(options, resolve, reject) {
  const log = options.log || SilentConsole;
  log.log('Checking for new articles...');

  if(!poll_acquire_lock(options.force_reset_lock, log)) {
    reject(new Error('locked'));
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    poll_release_lock(log);
    reject(new Error('offline'));
    return;
  }

  // navigator.connection is experimental
  if(!options.allow_metered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    poll_release_lock(log);
    reject(new Error('metered connection'));
    return;
  }

  if(!options.ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await query_idle_state(config.poll_feeds_idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      poll_release_lock(log);
      reject(new Error('not idle, state is ' + state));
      return;
    }
  }

  let conn = null;
  try {
    conn = await db_connect(undefined, log);
    const feeds = await db_get_all_feeds(conn, log);
    const pf_promises = feeds.map((feed) => poll_feed(conn, feed,
      options.skip_unmodified_guard, log));
    await Promise.all(pf_promises);
    log.debug('Polling completed');
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();
    show_notification('Updated articles',
      'Completed checking for new articles');
    resolve();
  } catch(error) {
    reject(error);
  } finally {
    poll_release_lock(log);
    if(conn) {
      log.debug('Closing database', conn.name);
      conn.close();
    }
  }
}

function poll_acquire_lock(force_reset_lock, log) {
  if(force_reset_lock)
    poll_release_lock(log);
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    log.debug('Failed to acquire lock, the lock is already present');
    return false;
  }
  log.debug('Acquiring poll lock');
  localStorage.POLL_FEEDS_ACTIVE = '1';
  return true;
}

function poll_release_lock(log) {
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    log.debug('Releasing poll lock');
    delete localStorage.POLL_FEEDS_ACTIVE;
  }
}

function poll_feed(conn, feed, skip_unmodified_guard, log) {
  return new Promise(poll_feed_impl.bind(undefined, conn, feed,
    skip_unmodified_guard, log));
}

async function poll_feed_impl(conn, feed, skip_unmodified_guard, log, resolve) {

  try {
    // log.debug('Processing feed', get_feed_url(feed));
    const exclude_entries = false;
    const url = new URL(get_feed_url(feed));
    let fetch_result = await fetch_feed(url, exclude_entries, log);
    let remote_feed = fetch_result.feed;
    // The dateUpdated check allows for newly subscribed feeds to never to be
    // considered unmodified
    if(!skip_unmodified_guard && feed.dateUpdated &&
      poll_feed_is_unmodified(feed, remote_feed)) {
      log.debug('Feed not modified', url.href);
      resolve();
      return;
    }

    const merged_feed = merge_feeds(feed, remote_feed);
    const stored_feed = await db_update_feed(log, conn, merged_feed);
    const entries = fetch_result.entries;
    // TODO: filter out entries without urls, and then check again against num
    // remaining. I could do this check per poll_entry promise though, maybe
    // there is no need for an extra preprocessing loop. Also, once I do this
    // I can remove the entry-has-url guarantee from fetch-feed and
    // parse-feed. The thing is that if I want to do filter dups I have to
    // pre-filter entries without urls
    // TODO: I should be filtering duplicate entries, compared by norm url,
    // somewhere. I somehow lost this functionality, or moved it somewhere
    const promises = entries.map((entry) => poll_entry(conn, feed, entry, log));
    const results = await Promise.all(promises);
    const num_entries_added = results.reduce((sum, r) => r ? sum + 1 : sum, 0);
    if(num_entries_added)
      await update_badge(conn, log);

    resolve();
  } catch(error) {
    log.debug(error);
    resolve(error);
  }
}

// TODO: maybe inline this again
function poll_feed_is_unmodified(f1, f2) {
  return f1.dateLastModified && f2.dateLastModified &&
    f1.dateLastModified.getTime() === f2.dateLastModified.getTime();
}

function poll_entry(conn, feed, entry, log) {
  return new Promise(poll_entry_impl.bind(undefined, conn, feed, entry, log));
}

// TODO: I should be looking up the entry's own favicon instead of inheriting
// from feed, do it after fetching the entry so I can possibly use the prepped
// document
// TODO: i should checking if the redirect url exists after fetching and before
// adding (if I even fetched)
// Resolve with true if entry was added, false if not added

async function poll_entry_impl(conn, feed, entry, log, resolve) {
  try {
    let url = get_entry_url(entry);
    //log.debug('Processing entry', url);
    const rewritten_url = rewrite_url(new URL(url));
    if(rewritten_url)
      add_entry_url(entry, rewritten_url.href);

    const find_limit = 1;
    const matches = await db_find_entry(log, conn, entry.urls, find_limit);
    if(matches.length) {
      resolve(false);
      return;
    }

    // Cascade feed properties (denormalize) for faster rendering
    entry.feed = feed.id;
    if(feed.faviconURLString)
      entry.faviconURLString = feed.faviconURLString;
    if(feed.title)
      entry.feedTitle = feed.title;

    const url_obj = new URL(get_entry_url(entry));

    if(config.interstitial_hosts.includes(url_obj.hostname)) {
      entry.content =
        'This content for this article is blocked by an advertisement.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(config.script_generated_hosts.includes(url_obj.hostname)) {
      entry.content = 'The content for this article cannot be viewed because ' +
        'it is dynamically generated.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(config.paywall_hosts.includes(url_obj.hostname)) {
      entry.content = 'This content for this article is behind a paywall.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(config.requires_cookies_hosts.includes(url_obj.hostname)) {
      entry.content = 'This content for this article cannot be viewed ' +
        'because the website requires tracking information.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(guess_if_url_is_non_html(url_obj)) {
      entry.content = 'This article is not a basic web page (e.g. a PDF).';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    let fetch_event;
    try {
      fetch_event = await fetch_html(url_obj, log);
    } catch(error) {
      poll_prep_local_doc(entry);
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    let response_url_str = fetch_event.response_url_str;
    add_entry_url(entry, response_url_str);
    const doc = fetch_event.document;
    transform_lazy_images(doc);
    filter_sourceless_images(doc);
    filter_invalid_anchors(doc);
    resolve_doc(doc, log, new URL(response_url_str));
    filter_tracking_images(doc, config.tracking_hosts, log);
    const num_images_modified = await set_image_dimensions(doc, log);
    poll_prep_doc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
    await db_add_entry(log, conn, entry);
    resolve(true);
  } catch(error) {
    log.debug(error);
    resolve(false); // Always resolve because of Promise.all
  }
}

function poll_prep_local_doc(entry) {
  if(!entry.content)
    return;
  const parser = new DOMParser();
  try {
    const doc = parser.parseFromString(entry.content, 'text/html');
    if(doc.querySelector('parsererror')) {
      entry.content = 'Cannot show document due to parsing error';
      return;
    }

    poll_prep_doc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
  } catch(error) {
  }
}

function poll_prep_doc(doc) {
  filter_boilerplate(doc);
  scrub_dom(doc);
  add_no_referrer(doc);
}
