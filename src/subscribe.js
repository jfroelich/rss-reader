// See license.md

'use strict';

// TODO: convert to promise so that callers can use async await
// TODO: this is blocked on converting favicon_lookup to promise
// TODO: before merging and looking up favicon and adding, check if
// is already subscribed to the redirected url, if a redirect occurred
// TODO: when converting to a promise I probably do not need to callback with
// an event, just with the subscribed feed, as errors will be otherwise caught
// TODO: maybe this shouldn't connect to db on demand because of how simpler
// it is now

async function subscribe(feed_db_conn, icon_cache_conn, feed, suppress_notifs,
  log = SilentConsole, callback) {

  log.log('Subscribing to', get_feed_url(feed));
  callback = callback || function(){};
  let should_close = false;

  try {
    if(!feed_db_conn) {
      feed_db_conn = await db_connect(undefined, log);
      should_close = true;
    }

    // Check if already subscribed
    const found = await db_contains_feed_url(log, feed_db_conn,
      get_feed_url(feed));
    if(found) {
      if(should_close)
        feed_db_conn.close();
      callback({'type': 'already_subscribed'});
      return;
    }

    // Subscribe while offline
    if('onLine' in navigator && !navigator.onLine) {
      log.debug('Offline subscription');
      let result = await db_add_feed(log, feed_db_conn, feed);
      if(should_close)
        feed_db_conn.close();
      callback({'type': 'success', 'feed': feed});
      return;
    }

    const req_url = new URL(get_feed_url(this.feed));
    const exclude_entries = true;
    let fetch_event = await fetch_feed(req_url, exclude_entries, log);
    let merged = merge_feeds(feed, fetch_event.feed);

    let url = null;
    if(merged.link) {
      url = new URL(merged.link);
    } else {
      const feed_url = new URL(get_feed_url(merged));
      url = new URL(feed_url.origin);
    }

    const doc = null;
    let favicon_db_target;
    const icon_url = await favicon_lookup(favicon_db_target, icon_cache_conn,
      url, doc, log);
    if(icon_url)
      merged.faviconURLString = icon_url.href;

    let added_feed = await db_add_feed(log, feed_db_conn, merged);
    if(should_close)
      feed_db_conn.close();
    if(!suppress_notifs) {
      const feed_name = added_feed.title || get_feed_url(added_feed);
      const message = 'Subscribed to ' + feed_name;
      show_notification('Subscription complete', message,
        merged.faviconURLString);
    }

    callback({'type': 'success', 'feed': added_feed});
  } catch(error) {
    console.log(error);
    callback({'type': error.message});
  }
}
