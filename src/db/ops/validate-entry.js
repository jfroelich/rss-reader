import is_valid_id from '/src/db/is-valid-id.js';
import {is_date_lte, is_valid_date, vassert} from '/src/db/validation-utils.js';
import assert from '/src/lib/assert.js';

const props = [
  'archive_state', 'archived_date', 'author', 'content', 'created_date',
  'read_date', 'updated_date', 'published_date', 'enclosure', 'favicon_url',
  'feed', 'feed_title', 'id', 'read_state', 'title', 'urls'
];

export default function validate_entry(entry) {
  // This is intentionally a weaker assert than is-entry, because validate-entry
  // may be called on either an actual entry or a plain object that resembles
  // one.
  assert(entry && typeof entry === 'object');

  const now = new Date();

  // TODO: validate favicon_url
  // TODO: validate feed_title
  // TODO: validate read_date
  // TODO: validate archived_date

  vassert(entry.id === undefined || is_valid_id(entry.id));
  vassert(entry.feed === undefined || is_valid_id(entry.feed));
  vassert(entry.urls === undefined || Array.isArray(entry.urls));
  vassert(
      entry.read_state === undefined || entry.read_state === 1 ||
      entry.read_state === 0);
  vassert(
      entry.archive_state === undefined || entry.archive_state === 1 ||
      entry.archive_state === 0);
  vassert(entry.author === undefined || typeof entry.author === 'string');
  vassert(entry.title === undefined || typeof entry.title === 'string');
  vassert(entry.content === undefined || typeof entry.content === 'string');

  vassert(is_valid_date(entry.created_date));
  vassert(is_date_lte(entry.created_date, now));
  vassert(is_valid_date(entry.updated_date));
  vassert(is_date_lte(entry.updated_date, now));
  vassert(is_date_lte(entry.created_date, entry.updated_date));
  vassert(is_valid_date(entry.published_date));
  vassert(is_date_lte(entry.published_date, now));
  validate_enclosure(entry.enclosure);
}

// Validate the enclosure property of a feed
function validate_enclosure(enc) {
  if (enc === undefined || enc === null) {
    return;
  }

  vassert(typeof enc === 'object');
  const url = enc.url;
  vassert(url === undefined || url === null || typeof url === 'string');
  const len = enc.enclosure_length;
  vassert(len === undefined || len === null || typeof len === 'string');
  const type = enc.type;
  vassert(type === undefined || type === null || typeof type === 'string');
}
