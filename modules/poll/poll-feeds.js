// See license.md

'use strict';

const poll = {};

poll.run = async function(options = {}) {
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

  const [feed_store, icon_conn] = await Promise.all([
    ReaderStorage.connect(log),
    favicon.connect(undefined, undefined, log)
  ]);

  let feeds = await feed_store.getFeeds();

  if(!options.ignore_recent_poll_guard) {
    const current_date = new Date();
    feeds = feeds.filter((feed) => {
      if(!feed.dateFetched)
        return true;
      const age = current_date - feed.dateFetched;//ms
      const old_enough = age > config.min_time_since_last_poll;
      if(!old_enough)
        log.debug('Feed polled too recently', Feed.getURL(feed));
      return old_enough;
    });
  }

  const promises = feeds.map((feed) => poll.process_feed(feed_store,
    icon_conn, feed, options.skip_unmodified_guard, log));
  const resolutions = await Promise.all(promises);
  const num_entries_added = resolutions.reduce((sum, added) => sum + added, 0);

  if(num_entries_added > 0) {
    await badge_update_text(feed_store, log);
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();

    DesktopNotification.show('Updated articles',
      'Added ' + num_entries_added + ' new articles');
  }

  feed_store.disconnect();
  icon_conn.close();
  log.debug('Polling completed');
  return num_entries_added;
};

poll.process_feed = async function(feed_store, icon_conn, feed,
  skip_unmodified_guard, log) {

  let num_entries_added = 0;
  const url = new URL(Feed.getURL(feed));
  const fetch_timeout = 5000;
  let remote_feed, entries;
  try {
    ({remote_feed = feed, entries} =
      await fetch_feed(url.href, fetch_timeout, log));
  } catch(error) {
    // A fetch error is not an exception
    // TODO: maybe it should be, and this should be wrapped in another promise
    // that always resolves
    return 0;
  }

  if(!skip_unmodified_guard && feed.dateUpdated &&
    feed.dateLastModified && remote_feed.dateLastModified &&
    feed.dateLastModified.getTime() ===
    remote_feed.dateLastModified.getTime()) {
    log.debug('Feed not modified', url.href);
    return num_entries_added;
  }

  const merged_feed = Feed.merge(feed, remote_feed);
  let storable_feed = Feed.sanitize(merged_feed);
  storable_feed = filter_empty_props(storable_feed);

  entries = entries.filter((entry) => entry.urls && entry.urls.length);
  entries = entries.filter(function has_valid_url(entry) {
    const url = entry.urls[0];
    let url_obj;
    try { url_obj = new URL(url); } catch(error) { return false; }
    if(url_obj.pathname.startsWith('//')) return false;// hack for bad feed
    return true;
  });

  entries = poll.filter_dup_entries(entries, log);
  entries.forEach((entry) => entry.feed = feed.id);

  for(let entry of entries) {
    entry.feedTitle = storable_feed.title;
  }

  const promises = entries.map((entry) => poll.process_entry(feed_store,
    icon_conn, storable_feed, entry, log));
  promises.push(feed_store.putFeed(storable_feed));
  const results = await Promise.all(promises);
  results.pop();// remove putFeed promise before reduce
  return results.reduce((sum, r) => r ? sum + 1 : sum, 0);
};

// Favors entries earlier in the list
// TODO: is there maybe a better way, like favor the most content or most recent
poll.filter_dup_entries = function(entries, log) {
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
};

// TODO: instead of trying to not reject in case of an error, maybe this should
// reject, and I use a wrapping function than translates rejections into
// negative resolutions

// Resolve with true if entry was added, false if not added
poll.process_entry = async function(feed_store, icon_conn, feed, entry, log) {
  // First check if the entry's original url exists
  if(await feed_store.containsEntryURL(entry.urls[0]))
    return false;

  // Rewrite. If rewritten then check if rewritten url exists
  const rewritten_url = rewrite_url(Entry.getURL(entry));
  if(rewritten_url) {
    if(await feed_store.containsEntryURL(rewritten_url))
      return false;
    Entry.addURL(entry, rewritten_url);
  }

  const request_url = new URL(Entry.getURL(entry));
  const reason = poll.derive_no_fetch_reason(request_url);
  if(reason) {

    // Temp, debugging 'undefined' in theweek.com article content
    console.debug('No fetch reason:', reason, request_url.href);

    const icon_url = await favicon.lookup(icon_conn, request_url, log);
    entry.faviconURLString = icon_url || feed.faviconURLString;
    entry.content = poll.no_fetch_reasons[reason];
    return await poll.add_entry(feed_store, entry, log);
  }

  let doc, response_url;
  try {
    const timeout = 5000;
    // The parens are needed for non-declaration object destructuring
    ({doc, response_url} = await fetch_html(request_url.href, timeout, log));
  } catch(error) {
    log.debug('Fetch html error', error);
    // If the fetch failed then fallback to the in-feed content
    // TODO: pass along a hint to skip the page fetch?
    const icon_url = await favicon.lookup(icon_conn, request_url, log);
    entry.faviconURLString = icon_url || feed.faviconURLString;
    poll.prep_local_entry(entry);
    return await poll.add_entry(feed_store, entry, log);
  }

  const redirected = poll.did_redirect(entry.urls, response_url);
  if(redirected) {
    if(await feed_store.containsEntryURL(response_url))
      return false;
    Entry.addURL(entry, response_url);
  }

  const lookup_url = redirected ? new URL(response_url) : request_url;
  const icon_url = await favicon.lookup(icon_conn, lookup_url, log);
  entry.faviconURLString = icon_url || feed.faviconURLString;

  poll.transform_lazy_images(doc, log);
  filter_sourceless_images(doc);
  filter_invalid_anchors(doc);
  resolve_doc(doc, log, new URL(Entry.getURL(entry)));
  poll.filter_tracking_images(doc, config.tracking_hosts, log);
  const num_images_modified = await set_image_dimensions(doc, log);
  poll.prep_doc(doc);
  entry.content = doc.documentElement.outerHTML.trim();
  return await poll.add_entry(feed_store, entry, log);
};

// Translate add rejections into resolutions so that poll.process_entry does not
// reject in the event of an error
poll.add_entry = async function(store, entry, log) {
  try {
    let result = await store.addEntry(entry);
    return true;
  } catch(error) {
    log.debug('Muted error while adding entry', error);
  }
  return false;
};

// To determine where there was a redirect, compare the response url to the
// entry's current urls, ignoring the hash. The response url will
// never have a hash, so we just need to strip the hash from the entry's
// other urls
poll.did_redirect = function(urls, response_url) {
  if(!response_url)
    throw new TypeError('response_url is undefined');
  const norm_urls = urls.map((url) => {
    const norm = new URL(url);
    norm.hash = '';
    return norm.href;
  });
  return !norm_urls.includes(response_url);
};

poll.no_fetch_reasons = {
  'interstitial':
    'This content for this article is blocked by an advertisement.',
  'script_generated': 'The content for this article cannot be viewed because ' +
    'it is dynamically generated.',
  'paywall': 'This content for this article is behind a paywall.',
  'cookies': 'This content for this article cannot be viewed ' +
    'because the website requires tracking information.',
  'not_html': 'This article is not a basic web page (e.g. a PDF).'
};

poll.derive_no_fetch_reason = function(url) {
  if(config.interstitial_hosts.includes(url.hostname))
    return poll.no_fetch_reasons.interstitial;
  if(config.script_generated_hosts.includes(url.hostname))
    return poll.no_fetch_reasons.script_generated;
  if(config.paywall_hosts.includes(url.hostname))
    return poll.no_fetch_reasons.paywall;
  if(config.requires_cookies_hosts.includes(url.hostname))
    return poll.no_fetch_reasons.cookies;
  if(mime.sniff_non_html(url.pathname))
    return poll.no_fetch_reasons.not_html;
  return null;
};

poll.prep_local_entry = function(entry) {
  if(!entry.content)
    return;
  const parser = new DOMParser();
  let doc;

  try {
    doc = parser.parseFromString(entry.content, 'text/html');
  } catch(error) {
  }

  if(!doc || doc.querySelector('parsererror')) {
    entry.content = 'Cannot show document due to parsing error';
    return;
  }

  poll.prep_doc(doc);
  const content = doc.documentElement.outerHTML.trim();
  if(content)
    entry.content = content;
};

poll.prep_doc = function(doc) {
  filter_boilerplate(doc);
  scrub_dom(doc);
  add_no_referrer(doc);
};

// the space check is a minimal validation, urls may be relative
// TODO: maybe use a regex and \s
// TODO: does the browser tolerate spaces in urls?
poll.transform_lazy_images = function(doc, log) {
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
};

// TODO: maybe I need to use array of regexes instead of simple strings array
// and iterate over the array instead of using array.includes(str)
// NOTE: this should only be called after img src urls have been resolved,
// because it assumes that all image src urls are absolute.
// NOTE: this should be called before image dimensions are checked, because
// checking image dimensions requires fetching images, which defeats the
// purpose of avoiding fetching
poll.filter_tracking_images = function(doc, hosts, log) {
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
};
