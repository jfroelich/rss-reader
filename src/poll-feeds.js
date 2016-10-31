// See license.md

'use strict';

// TODO: move tracking back into this file
// TODO: add is-active feed functionality, do not poll in-active feeds
// TODO: deactivate unreachable feeds after x failures
// TODO: deactivate feeds not changed for a long time
// TODO: store deactivation reason in feed
// TODO: store deactivation date

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

  let conn, icon_conn;
  try {
    conn = await db_connect(undefined, log);
    icon_conn = await favicon_connect(undefined, log);
    const feeds = await db_get_all_feeds(conn, log);
    const pf_promises = feeds.map((feed) => poll_feed(conn, icon_conn, feed,
      options.skip_unmodified_guard, log));
    await Promise.all(pf_promises);
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();
    show_notification('Updated articles',
      'Completed checking for new articles');
    resolve();
    poll_release_lock(log);

    if(conn) {
      log.debug('Closing database', conn.name);
      conn.close();
    }
    if(icon_conn) {
      log.debug('Closing database', icon_conn.name);
      icon_conn.close();
    }
    log.debug('Polling completed');
  } catch(error) {
    reject(error);
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

function poll_feed(conn, icon_conn, feed, skip_unmodified_guard, log) {
  return new Promise(poll_feed_impl.bind(undefined, conn, icon_conn, feed,
    skip_unmodified_guard, log));
}

async function poll_feed_impl(conn, icon_conn, feed, skip_unmodified_guard,
  log, resolve) {

  try {
    const url = new URL(get_feed_url(feed));
    const fetch_result = await fetch_feed(url, log);
    const remote_feed = fetch_result.feed;
    // The dateUpdated check allows for newly subscribed feeds to never to be
    // considered unmodified
    if(!skip_unmodified_guard && feed.dateUpdated &&
      poll_feed_is_unmodified(feed, remote_feed)) {
      log.debug('Feed not modified', url.href);
      resolve();
      return;
    }

    // Merge the local properties with the remote properties, favoring the
    // remote properties
    const merged_feed = merge_feeds(feed, remote_feed);
    // Prep the feed for storage
    let storable_feed = sanitize_feed(merged_feed);
    storable_feed = filter_empty_props(storable_feed);
    // Put the feed, keep a reference to the promise
    const put_feed_promise = db_put_feed(conn, storable_feed, log);
    let entries = fetch_result.entries;
    entries = poll_filter_dup_entries(entries, log);
    const promises = entries.map((entry) => poll_entry(conn, icon_conn,
      storable_feed, entry, log));
    promises.push(put_feed_promise);
    const results = await Promise.all(promises);
    results.pop();// remove put_feed_promise
    const num_entries_added = results.reduce((sum, r) => r ? sum + 1 : sum, 0);

    // TODO: I would rather not await this. I really need to look into how try
    // catch works around a non-awaited promised. Maybe one solution is to just
    // use .catch for now? what about premature calling of conn.close though?
    // Don't I have to await?
    if(num_entries_added) {
      await update_badge(conn, log);
    }

    resolve();
  } catch(error) {
    log.debug(error);
    resolve(error);// avoid Promise.all fail fast
  }
}

// TODO: maybe inline this again
function poll_feed_is_unmodified(f1, f2) {
  return f1.dateLastModified && f2.dateLastModified &&
    f1.dateLastModified.getTime() === f2.dateLastModified.getTime();
}

// Favors entries earlier in the list
// TODO: is there maybe a better way, like favor the most content or most recent
function poll_filter_dup_entries(entries, log) {
  const output = [];
  const seen_urls = [];

  for(let entry of entries) {
    // Pass along entries without urls to output
    if(!entry.urls || !entry.urls.length) {
      output.push(entry);
      continue;
    }

    let found = false;
    for(let url of entry.urls) {
      if(seen_urls.includes(url)) {
        found = true;
      }
    }

    if(!found) {
      output.push(entry);
      seen_urls.push(...entry.urls);
    }
  }

  return output;
}

function poll_entry(conn, icon_conn, feed, entry, log) {
  return new Promise(poll_entry_impl.bind(undefined, conn, icon_conn, feed,
    entry, log));
}

// Resolve with true if entry was added, false if not added
async function poll_entry_impl(conn, icon_conn, feed, entry, log, resolve) {

  // While some reader apps tolerate entries without urls, this app requires
  // them because links are used as GUIDs
  // Do not assume the entry has a url. It is this fn's responsibility to guard
  // against this constraint. Even though it could be checked earlier,
  // the earlier processes are not concerned with whether entries have urls
  if(!entry.urls || !entry.urls.length) {
    resolve(false);
    return;
  }

  try {
    // Rewrite the entry's url
    let url = get_entry_url(entry);
    const rewritten_url = rewrite_url(new URL(url));
    if(rewritten_url)
      add_entry_url(entry, rewritten_url.href);

    // Check if the entry exists
    const find_limit = 1;
    const matches = await db_find_entry(conn, entry.urls, find_limit, log);
    if(matches.length) {
      resolve(false);
      return;
    }

    // Create a url object to use for looking up the favicon and for fetching
    const request_url = new URL(get_entry_url(entry));

    // Cascade feed properties to the entry for faster rendering
    entry.feed = feed.id;
    if(feed.title)
      entry.feedTitle = feed.title;

    // Set the entry's favicon url
    const prefetched_doc = null;
    let icon_url = await favicon_lookup(undefined, icon_conn, request_url,
      prefetched_doc, log);
    if(icon_url)
      entry.faviconURLString = icon_url.href;
    else if(feed.faviconURLString)
      entry.faviconURLString = feed.faviconURLString;

    // Replace the entry's content with full text. Before fetching, check
    // if the entry should not be fetched
    if(config.interstitial_hosts.includes(request_url.hostname)) {
      entry.content =
        'This content for this article is blocked by an advertisement.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(config.script_generated_hosts.includes(request_url.hostname)) {
      entry.content = 'The content for this article cannot be viewed because ' +
        'it is dynamically generated.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(config.paywall_hosts.includes(request_url.hostname)) {
      entry.content = 'This content for this article is behind a paywall.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(config.requires_cookies_hosts.includes(request_url.hostname)) {
      entry.content = 'This content for this article cannot be viewed ' +
        'because the website requires tracking information.';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    if(guess_if_url_is_non_html(request_url)) {
      entry.content = 'This article is not a basic web page (e.g. a PDF).';
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    // If there is no reason not to fetch, then fetch
    let fetch_event;
    try {
      fetch_event = await fetch_html(request_url, log);
    } catch(error) {
      // If the fetch failed then fallback to the in-feed content
      poll_prep_local_doc(entry);
      await db_add_entry(log, conn, entry);
      resolve(true);
      return;
    }

    // Now that we have fetched successfully, the response url is available.
    const did_add_response_url = add_entry_url(entry,
      fetch_event.response_url_str);

    // Check if an entry with the response url exists
    if(did_add_response_url) {
      const redirect_matches = await db_find_entry(conn,
        [get_entry_url(entry)], find_limit, log);
      if(redirect_matches.length) {
        resolve(false);
        return;
      }
    }

    // It is a new entry and we have its full html. Cleanup the html
    const doc = fetch_event.document;
    poll_transform_lazy_images(doc, log);
    filter_sourceless_images(doc);
    filter_invalid_anchors(doc);
    resolve_doc(doc, log, new URL(get_entry_url(entry)));
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

// the space check is a minimal validation, urls may be relative
// TODO: maybe use a regex and \s
// TODO: does the browser tolerate spaces in urls?
function poll_transform_lazy_images(doc, log = SilentConsole) {
  let num_modified = 0;
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(img.hasAttribute('src') || img.hasAttribute('srcset'))
      continue;
    for(let alt_name of config.lazy_image_attr_names) {
      if(img.hasAttribute(alt_name)) {
        const url = img.getAttribute(alt_name);
        if(url && !url.trim().includes(' ')) {
          const before_html = img.outerHTML;
          img.removeAttribute(alt_name);
          img.setAttribute('src', url);
          //log.debug(before_html, 'transformed', img.outerHTML);
          num_modified++;
          break;
        }
      }
    }
  }
  return num_modified;
}
