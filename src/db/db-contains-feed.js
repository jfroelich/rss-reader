import {db_find_feed_by_url} from '/src/db/db-find-feed-by-url.js';

// Returns a promise that resolves to a boolean value indicating whether a feed
// exists in the database. How a feed is uniquely identified may change in the
// future. This is problematic for code that checks for existence because it is
// hard-coded to a particular approach. The purpose of this function is to
// abstract away how feeds are compared for equality when testing for existence.
// @param conn {IDBDatabase} an open database connection
// @param query {object} the query object, should contain a url property of type
// URL
// @throws {TypeError} if query object is malformed, url is not a url
// @throws {DOMException} if there is a database error
// TODO: probably should deprecate, this is so simple caller can do it, does not
// add much value
export async function db_contains_feed(conn, query) {
  if (!('url' in query)) {
    throw new TypeError('query missing url property');
  }

  // Because we are querying for existence, and not the full feed details, use
  // the key-only flag to avoid full deserialization
  const key_only = true;
  const feed = await db_find_feed_by_url(conn, query.url, key_only);
  return feed ? true : false;
}
