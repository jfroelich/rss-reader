// See license.md

'use strict';

function refresh_feed_icons(log = SilentConsole) {
  return new Promise(async function refresh_impl(resolve, reject) {
    log.log('Refreshing feed favicons...');
    let num_modified = 0;
    try {
      const feed_conn = await db_connect(undefined, undefined, log);
      const icon_conn = await favicon.connect(undefined, undefined, log);
      const feeds = await db_get_all_feeds(feed_conn, log);
      for(let feed of feeds) {
        const lookup_url = get_lookup_url(feed);
        const icon_url = await favicon.lookup(icon_conn, lookup_url, log);
        if(!icon_url)
          continue;
        if(!feed.faviconURLString || feed.faviconURLString !== icon_url) {
          num_modified++;
          feed.faviconURLString = icon_url;
          await db_put_feed(feed_conn, feed, log);
        }
      }
      log.log('Completed refreshing feed favicons. Modified %d', num_modified);
      resolve();
      feed_conn.close();
      icon_conn.close();
    } catch(error) {
      reject(error);
    }
  });

  function get_lookup_url(feed) {
    let url = null;
    if(feed.link) {
      url = new URL(feed.link);
    } else {
      const feed_url = get_feed_url(feed);
      url = new URL(new URL(feed_url).origin);
    }
    return url;
  }
}
