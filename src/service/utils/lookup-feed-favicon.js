import * as db from '/src/db/db.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';
import { LookupRequest, lookup } from '/lib/favicon.js';
import assert from '/lib/assert.js';

// Return the {URL} url of the favicon associated with the given feed. Throws an
// error if the feed has an invalid link property url, an invalid location
// url, or if the lookup itself encounters an error.
//
// @param feed {Object} an object in the model format, required
// @param iconn {IDBDatabase} optional, an open connection to the favicon db,
// if not specified then a cacheless lookup is performed
// @param timeout {Deadline} optional, the maximum number of milliseconds to
// wait when sending an http request to fetch the corresponding html document to
// check if it contains favicon information, defaults to indefinite (untimed)
// @return {Promise} returns a promise that resolves to the {URL} url of the
// favicon
export default function lookupFeedFavicon(feed, iconn, timeout = INDEFINITE) {
  assert(typeof feed === 'object');
  assert(iconn === undefined || iconn instanceof IDBDatabase);
  assert(timeout instanceof Deadline);

  // Build the lookup url, preferring the feed's link, and falling back to the
  // origin of the feed xml file's location.
  let lookupURL;
  if (feed.link) {
    lookupURL = new URL(feed.link);
  } else if (db.hasURL(feed)) {
    lookupURL = new URL(db.getURL(feed).origin);
  } else {
    const error = new Error('Cannot build lookup url for feed');
    return Promise.reject(error);
  }

  const request = new LookupRequest();
  request.conn = iconn;
  request.url = lookupURL;
  request.timeout = timeout;
  return lookup(request);
}
