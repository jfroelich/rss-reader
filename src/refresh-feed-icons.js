// See license.md

'use strict';

function refresh_feed_icons(log = SilentConsole) {
  return new Promise(refresh_feed_icons_impl.bind(undefined, log));
}

async function refresh_feed_icons_impl(log, resolve, reject) {
  log.log('Refreshing feed favicons...');
  let feed_db_conn, icon_db_conn, icon_db_target, prefetched_doc;
  let num_modified = 0;
  try {
    feed_db_conn = await db_connect(undefined, log);
    icon_db_conn = await favicon_connect(undefined, log);
    const feeds = await db_get_all_feeds(feed_db_conn, log);
    for(let feed of feeds) {
      const lookup_url = get_lookup_url(feed);
      log.debug('Feed lookup url', get_feed_url(feed), lookup_url.href);
      const icon_url = await favicon_lookup(icon_db_target, icon_db_conn,
        lookup_url, prefetched_doc, log);
      if(!icon_url)
        continue;
      if(!feed.faviconURLString || feed.faviconURLString !== icon_url.href) {
        num_modified++;
        feed.faviconURLString = icon_url.href;
        db_put_feed(feed_db_conn, feed, log);
      }
    }
    log.log('Completed refreshing feed favicons. Modified %d', num_modified);
    resolve();
  } catch(error) {
    reject(error);
  } finally {
    if(feed_db_conn)
      feed_db_conn.close();
    if(icon_db_conn)
      icon_db_conn.close();
  }

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
