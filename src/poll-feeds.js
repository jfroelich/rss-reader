// See license.md

'use strict';

// TODO: research why so much idle time, it is almost like fetch processing
// is not concurrent
// TODO: move tracking back into this file
// TODO: add is-active feed functionality, do not poll in-active feeds
// TODO: deactivate unreachable feeds after x failures
// TODO: deactivate feeds not changed for a long time
// TODO: store deactivation reason in feed
// TODO: store deactivation date

// TODO: maybe poll feeds itself does not need to be a promise, because it
// should never be called concurrently? I mean, it could be called concurrently
// with other promises that do different things, but I would never run two
// or more poll_feeds promises concurrently. Right now it is a promise simply
// because it originally had a callback parameter. But this was before async
// came along, and that was the only way to know the poll had resolved.

function poll_feeds(options = {}) {
  return new Promise(async function poll_feeds_impl(resolve, reject) {
    const log = options.log || SilentConsole;
    log.log('Checking for new articles...');

    // TODO: this is not necessarily an error
    if(!poll_acquire_lock(options.force_reset_lock, log)) {
      reject(new Error('locked'));
      return;
    }

    // TODO: is this an error or just an alternate resolution?
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

    // Get database connections. This blocks here because everything else
    // depends on both of these being available
    let conn, icon_conn;
    try {
      [conn, icon_conn] = await Promise.all([
        db_connect(undefined, undefined, log),
        favicon_connect(undefined, undefined, log)
      ]);
    } catch(error) {
      poll_release_lock(log);
      if(conn)
        conn.close();
      if(icon_conn)
        icon_conn.close();
      reject(error);
      return;
    }

    try {
      const feeds = await db_get_all_feeds(conn, log);
      const pf_promises = feeds.map((feed) => poll_feed(conn, icon_conn, feed,
        options.skip_unmodified_guard, log));
      const pf_results = await Promise.all(pf_promises);
      const num_entries_added = pf_results.reduce((sum,r)=> sum+r, 0);

      if(num_entries_added > 0) {
        // Must await to avoid calling on closed conn (??)
        await badge_update_text(conn, log);
        const chan = new BroadcastChannel('poll');
        chan.postMessage('completed');
        chan.close();
      }

      show_notification('Updated articles',
        'Added ' + num_entries_added + ' new articles');
      resolve();
    } catch(error) {
      reject(error);
    }

    // Cleanup
    poll_release_lock(log);
    log.debug('Closing database', conn.name);
    conn.close();
    log.debug('Closing database', icon_conn.name);
    icon_conn.close();
    log.debug('Polling completed');
  });
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
  return new Promise(async function poll_feed_impl(resolve) {
    let num_entries_added = 0;
    try {
      const url = new URL(get_feed_url(feed));
      const fetch_result = await fetch_feed(url, log);
      const remote_feed = fetch_result.feed;
      // The dateUpdated check allows for newly subscribed feeds to never to be
      // considered unmodified
      if(!skip_unmodified_guard && feed.dateUpdated &&
        poll_feed_is_unmodified(feed, remote_feed)) {
        log.debug('Feed not modified', url.href);
        resolve(num_entries_added);
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
      // Remove entries that are missing a url
      entries = entries.filter(poll_entry_has_url);
      entries = entries.filter(poll_entry_has_valid_url);
      // Remove duplicate entries
      entries = poll_filter_dup_entries(entries, log);
      const promises = entries.map((entry) => poll_entry(conn, icon_conn,
        storable_feed, entry, log));
      promises.push(put_feed_promise);
      const results = await Promise.all(promises);
      results.pop();// remove put_feed_promise
      num_entries_added = results.reduce((sum, r) => r ? sum + 1 : sum, 0);
      resolve(num_entries_added);
    } catch(error) {
      log.debug(error);
      resolve(num_entries_added);// avoid Promise.all fail fast
    }
  });
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

function poll_entry_has_url(entry) {
  return entry.urls && entry.urls.length;
}

function poll_entry_has_valid_url(entry) {
  const url = entry.urls[0];
  let url_obj;
  try { url_obj = new URL(url); } catch(error) { return false; }
  // Avoid a common error case I've seen in certain feeds
  if(url_obj.pathname.startsWith('//')) return false;
  return true;
}

// Resolve with true if entry was added, false if not added
// TODO: this should actually reject though if a real error occurred
function poll_entry(conn, icon_conn, feed, entry, log) {
  return new Promise(async function poll_entry_impl(resolve) {
    try {
      // Rewrite the entry's url
      let url = get_entry_url(entry);
      const rewritten_url = rewrite_url(new URL(url));
      if(rewritten_url)
        add_entry_url(entry, rewritten_url.href);

      // Check if the entry exists
      const entry_exists = await db_contains_entry(conn, entry.urls, log);
      if(entry_exists) {
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
      let icon_url = await favicon_lookup(icon_conn, request_url, log);
      if(icon_url)
        entry.faviconURLString = icon_url.href;
      else if(feed.faviconURLString)
        entry.faviconURLString = feed.faviconURLString;

      // Replace the entry's content with full text. Before fetching, check
      // if the entry should not be fetched
      if(config.interstitial_hosts.includes(request_url.hostname)) {
        entry.content =
          'This content for this article is blocked by an advertisement.';
        await db_add_entry(conn, entry, log);
        resolve(true);
        return;
      }

      if(config.script_generated_hosts.includes(request_url.hostname)) {
        entry.content = 'The content for this article cannot be viewed because ' +
          'it is dynamically generated.';
        await db_add_entry(conn, entry, log);
        resolve(true);
        return;
      }

      if(config.paywall_hosts.includes(request_url.hostname)) {
        entry.content = 'This content for this article is behind a paywall.';
        await db_add_entry(conn, entry, log);
        resolve(true);
        return;
      }

      if(config.requires_cookies_hosts.includes(request_url.hostname)) {
        entry.content = 'This content for this article cannot be viewed ' +
          'because the website requires tracking information.';
        await db_add_entry(conn, entry, log);
        resolve(true);
        return;
      }

      if(sniff_mime_non_html(request_url)) {
        entry.content = 'This article is not a basic web page (e.g. a PDF).';
        await db_add_entry(conn, entry, log);
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
        await db_add_entry(conn, entry, log);
        resolve(true);
        return;
      }

      // Now that we have fetched successfully, the response url is available.
      const did_add_response_url = add_entry_url(entry,
        fetch_event.response_url_str);

      // Check if an entry with the response url exists
      if(did_add_response_url) {
        const redirect_exists = await db_contains_entry(conn,
          [get_entry_url(entry)], log);
        if(redirect_exists) {
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
      await db_add_entry(conn, entry, log);
      resolve(true);
    } catch(error) {
      log.debug(error);
      resolve(false); // Always resolve because of Promise.all
    }
  });
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


// TODO: <img height="1" width="1" alt="" style="display:none"
// src="https://www.facebook.com/tr?id=619966238105738&amp;ev=PixelInitialized">
// - side note, this was revealed as non-html, I think from noscript
// <img src="http://dbg52463.moatads.com/?a=033f43a2ddba4ba592b52109d2ccf5ed"
// style="display:none;">
// <img src="http://d5i9o0tpq9sa1.cloudfront.net/
// ?a=033f43a2ddba4ba592b52109d2ccf5ed" style="display:none;">

// TODO: maybe I need to use array of regexes instead of simple strings array
// and iterate over the array instead of using array.includes(str)

// NOTE: this should only be called after img src urls have been resolved,
// because it assumes that all image src urls are absolute.
// NOTE: this should be called before image dimensions are checked, because
// checking image dimensions requires fetching images, which defeats the
// purpose of avoiding fetching
function filter_tracking_images(doc, hosts, log) {
  const min_valid_url_len = 3; // 1char hostname . 1char domain
  const images = doc.querySelectorAll('img[src]');
  let src, url;
  for(let image of images) {
    src = image.getAttribute('src');
    if(!src) continue;
    src = src.trim();
    if(!src) continue;
    if(src.length < min_valid_url_len) continue;
    if(src.includes(' ')) continue;
    if(!/^https?:/i.test(src)) continue;
    try {
      url = new URL(src);
    } catch(error) {
      continue;
    }
    if(hosts.includes(url.hostname))
      image.remove();
  }
}
