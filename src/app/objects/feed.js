import * as rdb from '/src/rdb/rdb.js';

// TODO: implement fully
// Return whether the feed has valid properties
// @param feed {any} any value, this should be a feed object, but it is not
// required
// @return {Boolean}
export function feed_is_valid(feed) {
  // feed_is_valid is generally called in the context of an assertion, so
  // while this could be its own assert, there is no need. It is simpler to
  // return here than throw an exception. It is, notably, generally an error to
  // ever call this function on something other than a feed, but that care is
  // left to the caller
  if (!rdb.is_feed(feed)) {
    return false;
  }

  // Validate the feed's id. It may not be present in the case of validating
  // a feed that has never been stored.
  if ('id' in feed && !rdb.feed_is_valid_id(feed.id)) {
    return false;
  }

  // NOTE: wait to fill out the rest of this until after finishing the
  // auto-connect deprecation

  return true;
}
