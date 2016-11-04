// See license.md

'use strict';

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
      log.debug('polling canceled due to idle requirement');
      return;
    }
  }

  const [conn, icon_conn] = await Promise.all([
    db_connect(undefined, undefined, log),
    favicon.connect(undefined, undefined, log)
  ]);

  const feeds = await db_get_all_feeds(conn, log);
  const promises = feeds.map((feed) => poll_feed(conn, icon_conn, feed,
    options.skip_unmodified_guard, log));
  const resolutions = await Promise.all(promises);
  const num_entries_added = resolutions.reduce((sum, added) => sum + added, 0);

  if(num_entries_added > 0) {
    await badge_update_text(conn, log);
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();

    show_notification('Updated articles',
      'Added ' + num_entries_added + ' new articles');
  }

  conn.close();
  icon_conn.close();
  log.debug('Polling completed');
  return num_entries_added;
}

async function poll_feed(conn, icon_conn, feed, skip_unmodified_guard, log) {
  let num_entries_added = 0;
  const url = new URL(get_feed_url(feed));

  // A fetch error is not an exception
  let fetch_result;
  try {
    fetch_result = await fetch_feed(url, log);
  } catch(error) {
    return 0;
  }

  const remote_feed = fetch_result.feed;
  if(!skip_unmodified_guard && feed.dateUpdated &&
    feed.dateLastModified && remote_feed.dateLastModified &&
    feed.dateLastModified.getTime() ===
    remote_feed.dateLastModified.getTime()) {
    log.debug('Feed not modified', url.href);
    return num_entries_added;
  }

  const merged_feed = merge_feeds(feed, remote_feed);
  let storable_feed = sanitize_feed(merged_feed);
  storable_feed = filter_empty_props(storable_feed);
  let entries = fetch_result.entries;
  entries = entries.filter((entry) => entry.urls && entry.urls.length);
  entries = entries.filter(function has_valid_url(entry) {
    const url = entry.urls[0];
    let url_obj;
    try { url_obj = new URL(url); } catch(error) { return false; }
    if(url_obj.pathname.startsWith('//')) return false;// hack for bad feed
    return true;
  });

  entries = poll_filter_dup_entries(entries, log);
  entries.forEach((entry) => entry.feed = feed.id);

  if(feed.title) {
    for(let entry of entries) {
      entry.feedTitle = storable_feed.title;
    }
  }

  const promises = entries.map((entry) => poll_entry(conn, icon_conn,
    storable_feed, entry, log));
  promises.push(db_put_feed(conn, storable_feed, log));
  const results = await Promise.all(promises);
  results.pop();// remove put_feed_promise
  return results.reduce((sum, r) => r ? sum + 1 : sum, 0);
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

// Resolve with true if entry was added, false if not added
async function poll_entry(conn, icon_conn, feed, entry, log) {
  const rewritten_url = rewrite_url(get_entry_url(entry));
  if(rewritten_url)
    add_entry_url(entry, rewritten_url);
  if(await db_contains_entry(conn, entry.urls, log))
    return false;
  const request_url = new URL(get_entry_url(entry));
  const reason = poll_get_no_fetch_reason(request_url);
  if(reason) {
    const icon_url = await favicon.lookup(icon_conn, request_url, log);
    entry.faviconURLString = icon_url || feed.faviconURLString;
    entry.content = POLL_NO_FETCH_REASON[reason];
    return await poll_add_entry(conn, entry, log);
  }

  let doc, response_url;
  try {
    [doc, response_url] = await fetch_html(request_url.href, log);
  } catch(error) {
    // If the fetch failed then fallback to the in-feed content
    // TODO: pass along a hint to skip the page fetch?
    const icon_url = await favicon.lookup(icon_conn, request_url, log);
    entry.faviconURLString = icon_url || feed.faviconURLString;
    poll_prep_local_doc(entry);
    return await poll_add_entry(conn, entry, log);
  }

  const redirected = poll_did_redirect(entry.urls, response_url);
  if(redirected) {
    const rexists = await db_contains_entry(conn, [response_url], log);
    if(rexists)
      return false;
    add_entry_url(entry, response_url);
  }

  const lookup_url = redirected ? new URL(response_url) : request_url;
  const icon_url = await favicon.lookup(icon_conn, lookup_url, log);
  entry.faviconURLString = icon_url || feed.faviconURLString;

  poll_transform_lazy_images(doc, log);
  filter_sourceless_images(doc);
  filter_invalid_anchors(doc);
  resolve_doc(doc, log, new URL(get_entry_url(entry)));
  filter_tracking_images(doc, config.tracking_hosts, log);
  const num_images_modified = await set_image_dimensions(doc, log);
  poll_prep_doc(doc);
  entry.content = doc.documentElement.outerHTML.trim();
  return await poll_add_entry(conn, entry, log);
}

// Translate add rejections into resolutions so that poll_entry does not
// reject in the event of an error
async function poll_add_entry(conn, entry, log) {
  try {
    let result = await db_add_entry(conn, entry, log);
    return true;
  } catch(error) {
    log.debug('Muted error while adding entry', error);
  }
  return false;
}

// To determine where there was a redirect, compare the response url to the
// entry's current urls, ignoring the hash. The response url will
// never have a hash, so we just need to strip the hash from the entry's
// other urls
function poll_did_redirect(urls, response_url) {
  if(!response_url)
    throw new TypeError('response_url is undefined');
  const norm_urls = urls.map((url) => {
    const norm = new URL(url);
    norm.hash = '';
    return norm.href;
  });
  return !norm_urls.includes(response_url);
}

const POLL_NO_FETCH_REASON = {
  'interstitial':
    'This content for this article is blocked by an advertisement.',
  'script_generated': 'The content for this article cannot be viewed because ' +
    'it is dynamically generated.',
  'paywall': 'This content for this article is behind a paywall.',
  'cookies': 'This content for this article cannot be viewed ' +
    'because the website requires tracking information.',
  'not_html': 'This article is not a basic web page (e.g. a PDF).'
}

function poll_get_no_fetch_reason(url) {
  if(config.interstitial_hosts.includes(url.hostname))
    return POLL_NO_FETCH_REASON.interstitial;
  if(config.script_generated_hosts.includes(url.hostname))
    return POLL_NO_FETCH_REASON.script_generated;
  if(config.paywall_hosts.includes(url.hostname))
    return POLL_NO_FETCH_REASON.paywall;
  if(config.requires_cookies_hosts.includes(url.hostname))
    return POLL_NO_FETCH_REASON.cookies;
  if(sniff_mime_non_html(url))
    return POLL_NO_FETCH_REASON.not_html;
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
          num_modified++;
          break;
        }
      }
    }
  }
  return num_modified;
}

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
