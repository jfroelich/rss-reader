import get_feed from '/src/db/ops/get-feed.js';
import db_open from '/src/db/ops/open.js';
import {unsubscribe} from '/src/ops/unsubscribe.js';

export default async function unsubscribe_command(url_string) {
  console.log('Unsubscribing from', url_string);

  const url = new URL(url_string);

  const conn = await db_open();
  const channel = new BroadcastChannel('reader');

  // unsubscribe does not check whether the feed actually exists, but we want
  // to know if that is the case in order to provide more information.

  const feed = await get_feed(conn, 'url', url, true);
  if (feed) {
    await unsubscribe(conn, channel, feed.id);
    console.log(
        'Unsubscribed from feed %s {id: %d, title: %s}', url.href, feed.id,
        feed.title);
  } else {
    console.warn(
        'Unsubscribe failed. You are not subscribed to the feed', url.href);
  }

  conn.close();
  channel.close();
}
