import {find_feed_by_url} from '/src/ops/find-feed-by-url.js';

export async function contains_feed(conn, query) {
  const key_only = true;
  const match = await find_feed_by_url(conn, query.url, key_only);
  return match ? true : false;
}
