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
// TODO: there are so many flags, use an options variable
// TODO: use Promise.all so that feeds are processed concurrently

function poll_feeds(force_reset_lock, ignore_idle_state, allow_metered,
  skip_unmodified_guard, log = SilentConsole) {
  return new Promise(poll_feeds_impl.bind(undefined, force_reset_lock,
    ignore_idle_state, allow_metered, skip_unmodified_guard, log));
}

async function poll_feeds_impl(force_reset_lock, ignore_idle_state,
  allow_metered, skip_unmodified_guard, log, resolve, reject) {
  log.log('Checking for new articles...');

  if(!poll_acquire_lock(force_reset_lock, log)) {
    reject(new Error('locked'));
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    reject(new Error('offline'));
    return;
  }

  // navigator.connection is experimental
  if(!allow_metered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    reject(new Error('metered connection'));
    return;
  }

  if(!ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const idle_period_secs = 30;
    try {
      const state = await query_idle_state(idle_period_secs);
      if(state !== 'locked' && state !== 'idle') {
        reject(new Error('cannot poll while not idle'));
        return;
      }

    } catch(error) {
      reject(error);
      return;
    }
  }

  let conn = null;
  try {
    conn = await db_connect(undefined, log);
    const feeds = await db_get_all_feeds(conn, log);
    const promises = feeds.map((feed) => poll_feed(conn, feed,
      skip_unmodified_guard, log));
    await Promise.all(promises);
    log.debug('Polling completed');
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();
    show_notification('Updated articles',
      'Completed checking for new articles');
    release_lock(log);
    resolve();
  } catch(error) {
    reject(error);
  } finally {
    if(conn)
      conn.close();
  }
}

function poll_acquire_lock(force_reset_lock, log) {
  if(force_reset_lock)
    release_lock(log);
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    log.debug('Failed to acquire lock, the lock is already present');
    return false;
  }
  log.debug('Acquiring poll lock');
  localStorage.POLL_FEEDS_ACTIVE = '1';
  return true;
}

function release_lock(log = SilentConsole) {
  if('POLL_FEEDS_ACTIVE' in localStorage) {
    log.debug('Releasing poll lock');
    delete localStorage.POLL_FEEDS_ACTIVE;
  }
}

function query_idle_state(idle_period_secs) {
  return new Promise(function(resolve) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
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
      feed_is_unmodified(feed, remote_feed)) {
      log.debug('Feed not modified', url.href);
      resolve();
      return;
    }

    const merged_feed = merge_feeds(feed, remote_feed);
    const stored_feed = await db_update_feed(log, conn, merged_feed);
    const entries = fetch_result.entries;
    // TODO: filter out entries without urls, and then check again against num
    // remaining.
    // TODO: I should be filtering duplicate entries, compared by norm url,
    // somewhere. I somehow lost this functionality, or moved it somewhere
    const promises = entries.map((entry) => poll_entry(conn, feed, entry, log));
    await Promise.all(promises);

    // TODO: only do this if entries were inserted
    await update_badge(conn, log);
    resolve();
  } catch(error) {
    log.debug(error);
    // Always resolve because of Promise.all fail fast behavior
    resolve(error);
  }
}

function feed_is_unmodified(f1, f2) {
  return f1.dateLastModified && f2.dateLastModified &&
    f1.dateLastModified.getTime() === f2.dateLastModified.getTime();
}

function poll_entry(conn, feed, entry, log) {
  return new Promise(poll_entry_impl.bind(undefined, conn, feed, entry, log));
}

// TODO: I should be looking up the entry's own favicon instead of inheriting
// from feed, do it after fetching the entry so I can possibly use the prepped
// document
// TODO: i should checking if the redirect url exists

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
      resolve();
      return;
    }

    // Cascade feed properties (denormalize) for faster rendering
    entry.feed = feed.id;
    if(feed.faviconURLString)
      entry.faviconURLString = feed.faviconURLString;
    if(feed.title)
      entry.feedTitle = feed.title;

    const url_obj = new URL(get_entry_url(entry));

    if(is_interstitial_url(url_obj)) {
      entry.content =
        'This content for this article is blocked by an advertisement.';
      await db_add_entry(log, conn, entry);
      resolve();
      return;
    }

    if(is_script_generated_content(url_obj)) {
      entry.content = 'The content for this article cannot be viewed because ' +
        'it is dynamically generated.';
      await db_add_entry(log, conn, entry);
      resolve();
      return;
    }

    if(is_paywall_url(url_obj)) {
      entry.content = 'This content for this article is behind a paywall.';
      await db_add_entry(log, conn, entry);
      resolve();
      return;
    }

    if(is_requires_cookies_url(url_obj)) {
      entry.content = 'This content for this article cannot be viewed ' +
        'because the website requires tracking information.';
      await db_add_entry(log, conn, entry);
      resolve();
      return;
    }

    if(is_non_html_url(url_obj)) {
      entry.content = 'This article is not a basic web page (e.g. a PDF).';
      await db_add_entry(log, conn, entry);
      resolve();
      return;
    }

    let fetch_event;
    try {
      fetch_event = await fetch_html(url_obj, log);
    } catch(error) {
      prep_local_doc(entry);
      await db_add_entry(log, conn, entry);
      resolve();
      return;
    }

    let response_url_str = fetch_event.response_url_str;
    add_entry_url(entry, response_url_str);
    const doc = fetch_event.document;
    transform_lazy_images(doc);
    filter_sourceless_images(doc);
    filter_invalid_anchors(doc);
    resolve_doc(doc, log, new URL(response_url_str));
    filter_tracking_images(doc);
    await set_image_dimensions(doc, log);
    prep_doc(doc);
    entry.content = doc.documentElement.outerHTML.trim();
    await db_add_entry(log, conn, entry);
    resolve();
  } catch(error) {
    log.debug(error);
    resolve(error); // Always resolve because of Promise.all
  }
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

function prep_doc(doc) {
  filter_boilerplate(doc);
  scrub_dom(doc);
  add_no_referrer(doc);
}

function is_non_html_url(url) {
  const bad_super_types = ['application', 'audio', 'image', 'video'];
  const type = guess_mime_type_from_url(url);
  if(type) {
    const super_type = type.substring(0, type.indexOf('/'));
    return bad_super_types.includes(super_type);
  }
}

function is_script_generated_content(url) {
  const hosts = [
    'productforums.google.com',
    'groups.google.com'
  ];
  return hosts.includes(url.hostname);
}

function is_requires_cookies_url(url) {
  const hosts = ['www.heraldsun.com.au', 'ripe73.ripe.net'];
  return hosts.includes(url.hostname);
}

function is_interstitial_url(url) {
  const hosts = [
    'www.forbes.com',
    'forbes.com'
  ];
  return hosts.includes(url.hostname);
}

// TODO: this eventually needs to be extendable, so that I can easily change
// the rules without changing the code
function is_paywall_url(url) {
  const hostname = url.hostname;
  return hostname.endsWith('nytimes.com');
}
