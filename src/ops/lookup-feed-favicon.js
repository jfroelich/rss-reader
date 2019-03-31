import * as locatable from '/src/db/locatable.js';
import assert from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import {lookup, LookupRequest} from '/src/lib/favicon.js';

// TODO: revisit the conclusion that finding the lookup url is independent of
// the model. If a feed already has a favicon_url property, then what is wrong
// with providing a utility function within the domain object itself? All we are
// doing at that point then is adding a convenience function that cuts out some
// common boilerplate, and provides consistent behavior. We are just exposing a
// transformed property with minimal business logic introduced.

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
export default function lookup_feed_favicon(feed, iconn, timeout = INDEFINITE) {
  assert(typeof feed === 'object');
  assert(iconn === undefined || iconn instanceof IDBDatabase);
  assert(timeout instanceof Deadline);

  // Build the lookup url, preferring the feed's link, and falling back to the
  // origin of the feed xml file's location.
  let lookup_url;
  if (feed.link) {
    lookup_url = new URL(feed.link);
  } else if (locatable.has_url(feed)) {
    lookup_url = new URL(locatable.get_url(feed).origin);
  } else {
    const error = new Error('Cannot build lookup url for feed');
    return Promise.reject(error);
  }

  const request = new LookupRequest();
  request.conn = iconn;
  request.url = lookup_url;
  request.timeout = timeout;
  return lookup(request);
}
