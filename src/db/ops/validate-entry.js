import Entry from '/src/db/entry.js';
import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import {is_entry} from '/src/db/types.js';
import {is_date_lte, is_valid_date, vassert} from '/src/db/validation-utils.js';
import assert from '/src/lib/assert.js';

export default function validate_entry(entry) {
  assert(is_entry(entry));
  const now = new Date();

  // TODO: validate favicon_url_string
  // TODO: validate feed_title
  // TODO: validate date_read

  vassert(entry.id === undefined || identifiable.is_valid_id(entry.id));
  vassert(entry.feed === undefined || identifiable.is_valid_id(entry.feed));
  vassert(entry.urls === undefined || Array.isArray(entry.urls));
  vassert(
      entry.read_state === undefined || entry.read_state === Entry.READ ||
      entry.read_state === Entry.UNREAD);
  vassert(
      entry.archive_state === undefined ||
      entry.archive_state === Entry.ARCHIVED ||
      entry.archive_state === Entry.UNARCHIVED);
  vassert(entry.author === undefined || typeof entry.author === 'string');
  vassert(entry.title === undefined || typeof entry.title === 'string');
  vassert(entry.content === undefined || typeof entry.content === 'string');

  vassert(is_valid_date(entry.date_created));
  vassert(is_date_lte(entry.date_created, now));
  vassert(is_valid_date(entry.date_updated));
  vassert(is_date_lte(entry.date_updated, now));
  vassert(is_date_lte(entry.date_created, entry.date_updated));
  vassert(is_valid_date(entry.date_published));
  vassert(is_date_lte(entry.date_published, now));
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
