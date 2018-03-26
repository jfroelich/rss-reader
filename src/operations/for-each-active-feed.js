import {get_feeds} from '/src/operations/get-feeds.js';

// Calls the callback function on each feed in the store
// TODO: currently each call to the callback is blocked by waiting for the
// prior callback to complete, essentially a serial progression. This should
// directly interact with the database instead of using get_feeds and
// pre-loading into an array, and this should walk the feed store and call the
// callback per cursor walk, advancing the cursor PRIOR to calling the callback,
// taking advantage of the asynchronous nature of indexedDB cursor request
// callbacks. This will yield a minor speedup at the cost of being a mild DRY
// violation. However, the speed is admittedly not that important. This will
// also make the approach scalable to N feeds (until stack overflow).

export async function for_each_active_feed(conn, callback) {
  const feeds = await get_feeds(conn);
  for (const feed of feeds) {
    callback(feed);
  }
}
