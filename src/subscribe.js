// See license.md

'use strict';

// TODO: before merging and looking up favicon and adding, check if
// is already subscribed to the redirected url, if a redirect occurred
// TODO: maybe this shouldn't connect to db on demand because of how simpler
// it is now, it should require an active feed_conn

function subscribe(feed_conn, icon_conn, feed, suppress_notifs,
  log = SilentConsole) {
  return new Promise(async function sub_impl(resolve, reject) {
    log.log('Subscribing to', get_feed_url(feed));
    let should_close = false;

    try {
      if(!feed_conn) {
        feed_conn = await db_connect(undefined, undefined, log);
        should_close = true;
      }

      const found = await db_contains_feed_url(log, feed_conn,
        get_feed_url(feed));
      if(found) {
        if(should_close)
          feed_conn.close();
        reject(new Error('Already subscribed'));
        return;
      }

      // Subscribe while offline
      if('onLine' in navigator && !navigator.onLine) {
        log.debug('Offline subscription');
        let result = await db_add_feed(log, feed_conn, feed);
        if(should_close)
          feed_conn.close();
        resolve(feed);
        return;
      }

      const req_url = new URL(get_feed_url(feed));
      const fetch_event = await fetch_feed(req_url, log);
      const merged = merge_feeds(feed, fetch_event.feed);

      let url;
      if(merged.link) {
        url = new URL(merged.link);
      } else {
        const feed_url = new URL(get_feed_url(merged));
        url = new URL(feed_url.origin);
      }

      const icon_url = await favicon_lookup(icon_conn, url, log);
      if(icon_url)
        merged.faviconURLString = icon_url.href;

      const added_feed = await db_add_feed(log, feed_conn, merged);
      if(should_close)
        feed_conn.close();
      if(!suppress_notifs) {
        const feed_name = added_feed.title || get_feed_url(added_feed);
        const message = 'Subscribed to ' + feed_name;
        show_notification('Subscription complete', message,
          merged.faviconURLString);
      }
      resolve(added_feed);
    } catch(error) {
      log.debug(error);
      reject(error);
    }
  });
}
