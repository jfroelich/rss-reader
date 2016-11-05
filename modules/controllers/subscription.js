// See license.md

'use strict';

// TODO: if redirected on fetch, check for reedirect url contained in db
async function subscribe(feed_conn, icon_conn, feed, suppress_notifs,
  log = SilentConsole) {

  log.log('Subscribing to', get_feed_url(feed));
  const found = await db_contains_feed_url(feed_conn, get_feed_url(feed), log);
  if(found)
    return;

  if('onLine' in navigator && !navigator.onLine) {
    log.debug('Offline subscription');
    return await db_add_feed(log, feed_conn, feed);
  }

  const req_url = new URL(get_feed_url(feed));
  let fetch_event;
  try {
    fetch_event = await fetch_feed(req_url, log);
  } catch(error) {
    return;
  }

  const merged = merge_feeds(feed, fetch_event.feed);

  let url;
  if(merged.link) {
    url = new URL(merged.link);
  } else {
    const feed_url = new URL(get_feed_url(merged));
    url = new URL(feed_url.origin);
  }

  try {
    const icon_url = await favicon.lookup(icon_conn, url, log);
    merged.faviconURLString = icon_url;
  } catch(error) {
    // Ignore
  }

  const added_feed = await db_add_feed(log, feed_conn, merged);
  if(!suppress_notifs) {
    const feed_name = added_feed.title || get_feed_url(added_feed);
    const message = 'Subscribed to ' + feed_name;
    show_notification('Subscription complete', message,
      merged.faviconURLString);
  }
  return added_feed;
}

async function unsubscribe(conn, feed_id, log = SilentConsole) {
  if(!Number.isInteger(feed_id) || feed_id < 1)
    throw new TypeError();
  log.log('Unsubscribing from feed with id', feed_id);
  const tx = conn.transaction(['feed', 'entry'], 'readwrite');
  const ids = await db_get_entry_ids_for_feed(tx, feed_id, log);
  const chan = new BroadcastChannel('db');
  const proms = ids.map((id) => db_delete_entry(tx, id, chan, log));
  proms.push(db_delete_feed(tx, feed_id, log));
  await Promise.all(proms);
  chan.close();
  return ids.length;
}
