import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import {is_date_lte, is_valid_date, vassert} from '/src/db/validation-utils.js';
import assert from '/src/lib/assert.js';

export default function validate_feed(feed) {
  assert(feed && typeof feed === 'object');
  const now = new Date();

  vassert(feed.id === undefined || identifiable.is_valid_id(feed.id));
  vassert(
      feed.active === undefined || feed.active === true ||
      feed.active === false);
  vassert(feed.urls === undefined || Array.isArray(feed.urls));
  vassert(feed.title === undefined || typeof feed.title === 'string');
  vassert(
      feed.type === undefined || feed.type === 'rss' || feed.type === 'feed' ||
      feed.type === 'rdf');
  vassert(feed.link === undefined || typeof feed.link === 'string');
  vassert(
      feed.description === undefined || typeof feed.description === 'string');
  vassert(
      feed.deactivation_reason === undefined ||
      typeof feed.deactivation_reason === 'string');

  vassert(is_valid_date(feed.deactivation_date));
  vassert(is_date_lte(feed.deactivation_date, now));
  vassert(is_valid_date(feed.created_date));
  vassert(is_date_lte(feed.created_date, now));
  vassert(is_date_lte(feed.created_date, feed.deactivation_date));
  vassert(is_valid_date(feed.updated_date));
  vassert(is_date_lte(feed.updated_date, now));
  vassert(is_date_lte(feed.created_date, feed.updated_date));
  vassert(is_valid_date(feed.published_date));
  vassert(is_date_lte(feed.published_date, now));
}
