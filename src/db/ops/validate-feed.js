import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import {is_feed} from '/src/db/types.js';
import {is_date_lte, is_valid_date, vassert} from '/src/db/validation-utils.js';
import assert from '/src/lib/assert.js';

export default function validate_feed(feed) {
  assert(is_feed(feed));
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
      feed.deactivation_reason_text === undefined ||
      typeof feed.deactivation_reason_text === 'string');

  vassert(is_valid_date(feed.deactivate_date));
  vassert(is_date_lte(feed.deactivate_date, now));
  vassert(is_valid_date(feed.date_created));
  vassert(is_date_lte(feed.date_created, now));
  vassert(is_date_lte(feed.date_created, feed.deactivate_date));
  vassert(is_valid_date(feed.date_updated));
  vassert(is_date_lte(feed.date_updated, now));
  vassert(is_date_lte(feed.date_created, feed.date_updated));
  vassert(is_valid_date(feed.date_published));
  vassert(is_date_lte(feed.date_published, now));
}
