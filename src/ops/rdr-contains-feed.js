import {rdr_find_feed_by_url} from '/src/ops/rdr-find-feed-by-url.js';

// The `rdr_contains_feed` function checks for whether the query matches a feed.
// Returns a promise that resolves to a boolean value indicating whether a feed
// exists in the database. The purpose of this operation is to abstract away the
// logic in determining whether a feed exists.
//
// @param conn {IDBDatabase} an open database connection
// @param query {object} the query object, should contain a URL property
// @throws {TypeError} if query object is malformed, url is not a url
// @throws {DOMException} if there is a database error
export async function rdr_contains_feed(conn, query) {
  // Because we are querying for existence, and not the full feed details,
  // use the key-only flag to avoid full deserialization
  const key_only = true;
  const match = await rdr_find_feed_by_url(conn, query.url, key_only);
  return match ? true : false;
}
