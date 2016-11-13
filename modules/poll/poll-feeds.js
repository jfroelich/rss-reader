// See license.md

'use strict';

// TODO: revert to using a class, I don't need to pass around as many variables
// like db connections, and can setup property injection, and more easily
// decouple SilentConsole

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

  const feedDb = new FeedDb();
  feedDb.log = log;

  const [_, icon_conn] = await Promise.all([
    feedDb.connect(),
    Favicon.connect()
  ]);

  let feeds = await feedDb.getFeeds();

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

  const promises = feeds.map((feed) => poll.process_feed(feedDb,
    icon_conn, feed, options.skip_unmodified_guard, log));
  const resolutions = await Promise.all(promises);
  const num_entries_added = resolutions.reduce((sum, added) => sum + added, 0);

  if(num_entries_added > 0) {
    await badge_update_text(feedDb, log);
    const chan = new BroadcastChannel('poll');
    chan.postMessage('completed');
    chan.close();

    DesktopNotification.show('Updated articles',
      'Added ' + num_entries_added + ' new articles');
  }

  feedDb.close();
  icon_conn.close();
  log.debug('Polling completed');
  return num_entries_added;
};

// TODO: maybe this should bubble fetch errors upward, and this should be
// wrapped in another promise that always resolves

poll.process_feed = async function(feedDb, icon_conn, localFeed,
  skip_unmodified_guard, log) {

  let num_entries_added = 0;
  const url = new URL(Feed.getURL(localFeed));
  const fetch_timeout = 5000;
  let remote_feed, remote_entries;
  try {
    // I am using this long form destructuring because this was previously
    // the source of a bug. fetch_feed produces an object with a property titled
    // 'feed' which was the same name as the feed parameter to process_feed,
    // which resulted in 'feed' getting overwritten. Now the function param
    // is named localFeed for clarity.
    const {feed, entries} = await fetch_feed(url.href, fetch_timeout, log);
    remote_feed = feed;
    remote_entries = entries;
  } catch(error) {
    log.warn(error);
    return 0;
  }

  if(!skip_unmodified_guard && localFeed.dateUpdated &&
    localFeed.dateLastModified && remote_feed.dateLastModified &&
    (localFeed.dateLastModified.getTime() ===
    remote_feed.dateLastModified.getTime())) {
    log.debug('Feed not modified', url.href, localFeed.dateLastModified,
      remote_feed.dateLastModified);
    return num_entries_added;
  }

  const merged_feed = Feed.merge(localFeed, remote_feed);
  let storable_feed = Feed.sanitize(merged_feed);
  storable_feed = filter_empty_props(storable_feed);

  // Filter entries missing urls
  remote_entries = remote_entries.filter((e) => e.urls && e.urls.length);

  // Filter entries with invalid urls
  remote_entries = remote_entries.filter((e) => {
    const url = e.urls[0];
    let url_obj;
    try {
      url_obj = new URL(url);
    } catch(error) {
      log.warn(error);
      return false;
    }
    if(url_obj.pathname.startsWith('//')) return false;// hack for bad feed
    return true;
  });

  remote_entries = poll.filter_dup_entries(remote_entries);
  remote_entries.forEach((e) => e.feed = localFeed.id);

  for(let entry of remote_entries) {
    entry.feedTitle = storable_feed.title;
  }

  const promises = remote_entries.map((entry) => poll.process_entry(feedDb,
    icon_conn, storable_feed, entry, log));
  promises.push(feedDb.putFeed(storable_feed));
  const results = await Promise.all(promises);
  results.pop();// remove putFeed promise before reduce
  return results.reduce((sum, r) => r ? sum + 1 : sum, 0);
};

// Favors entries earlier in the list
// TODO: is there maybe a better way, like favor the most content or most recent
poll.filter_dup_entries = function(entries) {
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

// Rewrite the url and append it to the entry's url list if it is different
poll.rewrite_entry_url = function(entry) {
  const url = Entry.getURL(entry);
  const rewritten_url = rewrite_url(url);
  const before_append_length = entry.urls.length;
  if(rewritten_url)
    Entry.addURL(entry, rewritten_url);
  return entry.urls.length > before_append_length;
};

// Resolve with true if entry was added, false if not added
// TODO: instead of trying to not reject in case of an error, maybe this should
// reject, and I use a wrapping function than translates rejections into
// negative resolutions
poll.process_entry = async function(feedDb, icon_conn, feed, entry, log) {
  const rewritten = poll.rewrite_entry_url(entry);
  if(poll.should_exclude_entry(entry))
    return false;
  if(await feedDb.containsEntryURL(entry.urls[0]))
    return false;
  if(rewritten && await feedDb.containsEntryURL(Entry.getURL(entry)))
    return false;

  const request_url = new URL(Entry.getURL(entry));
  const icon_url = await Favicon.lookup(icon_conn, request_url, log);
  entry.faviconURLString = icon_url || feed.faviconURLString;

  let doc, response_url;
  try {
    const timeout = 5000;
    ({doc, response_url} = await fetch_html(request_url.href, timeout, log));
  } catch(error) {
    log.warn(error);
    poll.prep_local_entry(entry);
    return await poll.add_entry(feedDb, entry, log);
  }

  const redirected = poll.did_redirect(entry.urls, response_url);
  if(redirected) {
    if(await feedDb.containsEntryURL(response_url))
      return false;
    Entry.addURL(entry, response_url);
  }

  poll.transform_lazy_images(doc);
  filter_sourceless_images(doc);
  filter_invalid_anchors(doc);
  resolve_doc(doc, new URL(Entry.getURL(entry)));
  poll.filter_tracking_images(doc, config.tracking_hosts, log);

  const fetch_image_timeout = 4000;
  const num_images_modified =
    await DocumentLayout.setDocumentImageDimensions(doc, fetch_image_timeout);
  poll.prep_doc(doc);
  entry.content = doc.documentElement.outerHTML.trim();
  return await poll.add_entry(feedDb, entry, log);
};

// Suppress errors so that Promise.all fully iterates
poll.add_entry = async function(store, entry, log) {
  try {
    let result = await store.addEntry(entry);
    return true;
  } catch(error) {
    log.warn(error);
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

poll.should_exclude_entry = function(entry) {
  const url = new URL(Entry.getURL(entry));
  const hostname = url.hostname;
  const pathname = url.pathname;
  if(config.interstitial_hosts.includes(hostname))
    return true;
  if(config.script_generated_hosts.includes(hostname))
    return true;
  if(config.paywall_hosts.includes(hostname))
    return true;
  if(config.requires_cookies_hosts.includes(hostname))
    return true;
  if(mime.sniff_non_html(pathname))
    return true;
  return false;
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
poll.transform_lazy_images = function(doc) {
  let num_modified = 0;
  const images = doc.querySelectorAll('img');
  for(let img of images) {
    if(img.hasAttribute('src') || img.hasAttribute('srcset'))
      continue;
    for(let alt_name of config.lazy_image_attr_names) {
      if(img.hasAttribute(alt_name)) {
        const url = img.getAttribute(alt_name);
        if(url && !url.trim().includes(' ')) {
          // const before_html = img.outerHTML;
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
