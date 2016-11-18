// See license.md

'use strict';

async function refresh_feed_icons(log = SilentConsole) {
  log.log('Refreshing feed favicons...');
  let num_modified = 0;

  const readerDb = new ReaderDb();
  const feedStore = new FeedStore();

  const fs = new FaviconService();
  fs.log = log;
  fs.cache.log = log;

  let readerConn;

  try {
    const connections = await Promise.all([readerDb.connect(), fs.connect()]);
    readerConn = connections[0];

    feedStore.conn = readerConn;

    const feeds = await feedStore.getAll();
    for(let feed of feeds) {
      const lookup_url = get_lookup_url(feed);
      const icon_url = await fs.lookup(lookup_url);
      if(!icon_url)
        continue;
      if(!feed.faviconURLString || feed.faviconURLString !== icon_url) {
        num_modified++;
        feed.faviconURLString = icon_url;
        await feedStore.put(feed);
      }
    }
    log.log('Completed refreshing feed favicons. Modified %d', num_modified);

  } finally {
    fs.close();
    if(readerConn)
      readerConn.close();
  }


  // TODO: this should be a function in feed.js
  // TODO: there is no longer a guarantee that feed.link contains a valid
  // url, need a try/catch
  function get_lookup_url(feed) {
    let url = null;
    if(feed.link) {
      url = new URL(feed.link);
    } else {
      const feed_url = Feed.getURL(feed);
      url = new URL(new URL(feed_url).origin);
    }
    return url;
  }
}
