import get_feed from '/src/db/ops/get-feed.js';
import open from '/src/db/ops/open.js';
import {unsubscribe} from '/src/ops/unsubscribe.js';

export default async function unsubscribe_command(url_string) {
  console.log('Unsubscribing from', url_string);

  const url = new URL(url_string);

  const conn = await open();

  // unsubscribe does not check whether the feed actually exists, but we want
  // to know if that is the case in order to provide more information.
  const feed = await get_feed(conn, 'url', url, true);
  if (feed) {
    await unsubscribe(conn, feed.id);

    const info = {};
    info.url = url.href;
    info.id = feed.id;
    info.title = feed.title;

    console.log('Unsubscribed from feed', info);
  } else {
    console.warn('Not subscribed to feed', url.href);
  }

  conn.close();
}
