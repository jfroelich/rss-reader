// See license.md

'use strict';

// TODO: if redirected on fetch, check for reedirect url contained in db
async function subscribe(store, icon_conn, feed, suppress_notifs,
  log = SilentConsole) {

  log.log('Subscribing to', Feed.getURL(feed));
  if(await store.containsFeedURL(Feed.getURL(feed)))
    return;

  if('onLine' in navigator && !navigator.onLine) {
    log.debug('Offline subscription');
    return await store.addFeed(feed);
  }

  const req_url = new URL(Feed.getURL(feed));
  let fetch_event;
  try {
    fetch_event = await fetch_feed(req_url, log);
  } catch(error) {
    return;
  }

  const merged = Feed.merge(feed, fetch_event.feed);

  let url;
  if(merged.link) {
    url = new URL(merged.link);
  } else {
    const feed_url = new URL(Feed.getURL(merged));
    url = new URL(feed_url.origin);
  }

  try {
    const icon_url = await favicon.lookup(icon_conn, url, log);
    merged.faviconURLString = icon_url;
  } catch(error) {
    // Ignore
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
