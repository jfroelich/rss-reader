// See license.md

'use strict';

// TODO: if redirected on fetch, check for reedirect url contained in db
async function subscribe(store, icon_conn, feed, suppress_notifs,
  log = SilentConsole) {

  const url = Feed.getURL(feed);

  log.log('Subscribing to', url);
  if(await store.containsFeedURL(url))
    return;

  if('onLine' in navigator && !navigator.onLine) {
    log.debug('Offline subscription');
    return await store.addFeed(feed);
  }

  // TODO: this should be a parameter
  const fetch_timeout = 2000;
  let remote_feed;
  try {
    // Destructure ignoring entries
    ({remote_feed} = await fetch_feed(url, fetch_timeout, log));
  } catch(error) {
    // Fatal
    console.warn(error);
    return;
  }

  const merged = Feed.merge(feed, remote_feed);

  // TODO: this should be a function in feed.js
  let lookup_url;
  if(merged.link) {
    lookup_url = new URL(merged.link);
  } else {
    const feed_url = new URL(Feed.getURL(merged));
    lookup_url = new URL(feed_url.origin);
  }

  try {
    const icon_url = await Favicon.lookup(icon_conn, lookup_url, log);
    merged.faviconURLString = icon_url;
  } catch(error) {
    // Non-fatal
    log.warn(error);
  }

  const added_feed = await store.addFeed(merged);
  if(!suppress_notifs) {
    const feed_name = added_feed.title || Feed.getURL(added_feed);
    const message = 'Subscribed to ' + feed_name;
    DesktopNotification.show('Subscription complete', message,
      merged.faviconURLString);
  }
  return added_feed;
}

async function unsubscribe(store, feed_id, log = SilentConsole) {
  if(!Number.isInteger(feed_id) || feed_id < 1)
    throw new TypeError('invalid feed id');
  log.log('Unsubscribing from feed', feed_id);
  const tx = store.conn.transaction(['feed', 'entry'], 'readwrite');
  const ids = await store.getFeedEntryIds(tx, feed_id);
  const chan = new BroadcastChannel('db');
  const proms = ids.map((id) => store.removeEntry(tx, id, chan));
  proms.push(store.removeFeed(tx, feed_id));
  await Promise.all(proms);
  chan.close();
  return ids.length;
}
