// See license.md

'use strict';

// TODO: move these notes to github issues
// TODO: research why so much idle time, it is almost like fetch processing
// is not concurrent
// TODO: add is-active feed functionality, do not poll in-active feeds
// TODO: deactivate unreachable feeds after x failures
// TODO: deactivate feeds not changed for a long time
// TODO: store deactivation reason in feed
// TODO: store deactivation date
// TODO: require a minimum amount of time to elapse before checking a feed
// again, as a throttling mechanism

async function poll_feeds(options = {}) {
  const log = options.log || SilentConsole;
  log.log('Checking for new articles...');

  if('onLine' in navigator && !navigator.onLine) {
    log.debug('polling canceled because offline');
    return;
  }

  // experimental
  if(!options.allow_metered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    log.debug('polling canceled due to metered connection');
    return;
  }

  if(!options.ignore_idle_state && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await query_idle_state(config.poll_feeds_idle_period_secs);
    if(state !== 'locked' && state !== 'idle') {
      poll_release_lock(log);
      log.debug('polling canceled due to idle requirement');
      return;
    }
  }

  const [conn, icon_conn] = await Promise.all([
    db_connect(undefined, undefined, log),
    favicon.connect(undefined, undefined, log)
  ]);

  const feeds = await db_get_all_feeds(conn, log);
  const pf_promises = feeds.map((feed) => poll_feed(conn, icon_conn, feed,
    options.skip_unmodified_guard, log));
  const pf_results = await Promise.all(pf_promises);
  const num_entries_added = pf_results.reduce((sum,r)=> sum+r, 0);

  if(num_entries_added > 0) {
    await badge_update_text(conn, log);
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();
  }

  show_notification('Updated articles',
    'Added ' + num_entries_added + ' new articles');

  conn.close();
  icon_conn.close();
  log.debug('Polling completed');
}

async function poll_feed(conn, icon_conn, feed, skip_unmodified_guard, log) {
  let num_entries_added = 0;
  const url = new URL(get_feed_url(feed));

  // A fetch error is not an exception
  let fetch_result;
  try {
    fetch_result = await fetch_feed(url, log);
  } catch(error) {
    return;
  }

  const remote_feed = fetch_result.feed;
  if(!skip_unmodified_guard && feed.dateUpdated &&
    poll_feed_is_unmodified(feed, remote_feed)) {
    log.debug('Feed not modified', url.href);
    return num_entries_added;
  }

  // Merge the local properties with the remote properties, favoring the
  // remote properties
  const merged_feed = merge_feeds(feed, remote_feed);
  // Prep the feed for storage
  let storable_feed = sanitize_feed(merged_feed);
  storable_feed = filter_empty_props(storable_feed);

  const put_feed_promise = db_put_feed(conn, storable_feed, log);
  let entries = fetch_result.entries;
  // TODO: inline these
  entries = entries.filter(poll_entry_has_url);
  entries = entries.filter(poll_entry_has_valid_url);
  entries = poll_filter_dup_entries(entries, log);
  const promises = entries.map((entry) => poll_entry(conn, icon_conn,
    storable_feed, entry, log));
  promises.push(put_feed_promise);
  const results = await Promise.all(promises);
  results.pop();// remove put_feed_promise
  return results.reduce((sum, r) => r ? sum + 1 : sum, 0);
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
        break;
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
  // Avoid a common error case
  if(url_obj.pathname.startsWith('//')) return false;
  return true;
}

// Resolve with true if entry was added, false if not added
async function poll_entry(conn, icon_conn, feed, entry, log) {
  let url = get_entry_url(entry);
  const rewritten_url = rewrite_url(new URL(url));
  if(rewritten_url)
    add_entry_url(entry, rewritten_url.href);

  const entry_exists = await db_contains_entry(conn, entry.urls, log);
  if(entry_exists)
    return false;

  const request_url = new URL(get_entry_url(entry));

  // TODO: maybe do this in caller using for of
  entry.feed = feed.id;
  if(feed.title)
    entry.feedTitle = feed.title;

  // TODO: double check lookup onlyerrors when a real error occurs
  const icon_url = await favicon.lookup(icon_conn, request_url, log);
  entry.faviconURLString = icon_url || feed.faviconURLString;

  // Replace the entry's content with full text. Before fetching, check
  // if the entry should not be fetched
  if(config.interstitial_hosts.includes(request_url.hostname)) {
    entry.content =
      'This content for this article is blocked by an advertisement.';
    await db_add_entry(conn, entry, log);
    return true;
  }

  if(config.script_generated_hosts.includes(request_url.hostname)) {
    entry.content = 'The content for this article cannot be viewed because ' +
      'it is dynamically generated.';
    await db_add_entry(conn, entry, log);
    return true;
  }

  if(config.paywall_hosts.includes(request_url.hostname)) {
    entry.content = 'This content for this article is behind a paywall.';
    await db_add_entry(conn, entry, log);
    return true;
  }

  if(config.requires_cookies_hosts.includes(request_url.hostname)) {
    entry.content = 'This content for this article cannot be viewed ' +
      'because the website requires tracking information.';
    await db_add_entry(conn, entry, log);
    return true;
  }

  if(sniff_mime_non_html(request_url)) {
    entry.content = 'This article is not a basic web page (e.g. a PDF).';
    await db_add_entry(conn, entry, log);
    return true;
  }

  // Trap fetch errors, those are not programming errors
  let fetch_event;
  try {
    fetch_event = await fetch_html(request_url, log);
  } catch(error) {
    // If the fetch failed then fallback to the in-feed content
    poll_prep_local_doc(entry);
    await db_add_entry(conn, entry, log);
    return true;
  }

  // Now that we have fetched successfully, the response url is available.
  const redirected = add_entry_url(entry, fetch_event.response_url_str);

  if(redirected && await db_contains_entry(conn, [get_entry_url(entry)], log))
    return false;

  // Cleanup the html
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
  return true;
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
