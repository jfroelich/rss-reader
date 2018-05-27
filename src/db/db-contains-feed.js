import {db_find_feed_by_url} from '/src/db/db-find-feed-by-url.js';

// Returns a promise that resolves to a boolean value indicating whether a feed
// exists in the database. How a feed is uniquely identified may change in the
// future. This is problematic for code that checks for existence because it is
// hard-coded to a particular approach. The purpose of `db_contains_feed` is to
// abstract away how feeds are compared for equality when testing for existence.

// ### Params
// * **conn** {IDBDatabase} an open database connection
// * **query** {object} the query object, should contain a URL property

// ### Errors
// * {TypeError} if query object is malformed, url is not a url
// * {DOMException} if there is a database error

// ### Internal notes
// Because we are querying for existence, and not the full feed details, use the
// key-only flag to avoid full deserialization

// TODO: probably should deprecate, this is so simple caller can do it, does not
// add much value

export async function db_contains_feed(conn, query) {
  const key_only = true;
  const match = await db_find_feed_by_url(conn, query.url, key_only);
  return match ? true : false;
}
