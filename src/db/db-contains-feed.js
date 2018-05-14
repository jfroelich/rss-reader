import {find_feed_by_url} from '/src/db/db-find-feed-by-url.js';

// TODO: probably should deprecate, this is so simple caller can do it, does not
// add much value

export async function db_contains_feed(conn, query) {
  const key_only = true;
  const match = await find_feed_by_url(conn, query.url, key_only);
  return match ? true : false;
}
