import {is_feed, is_valid_feed_id} from '/src/feed.js';


// TODO: drop the db prefix, the name is a concern of an importing module and
// not a concern of the exporting module, and the prefix is an overqualification

// TODO: finish all checks
export function db_validate_feed(feed) {
  if (!is_feed(feed)) {
    return false;
  }

  if ('id' in feed && !is_valid_feed_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  if ('urls' in feed && !Array.isArray(feed.urls)) {
    return false;
  }

  return true;
}
