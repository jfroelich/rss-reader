import {Entry, is_entry} from '/src/db/object/entry.js';
import {Feed} from '/src/db/object/feed.js';
import {is_date_lte, is_valid_date, vassert} from '/src/db/utils.js';
import assert from '/src/lib/assert.js';

export default function validate_entry(entry) {
  assert(is_entry(entry));
  const now = new Date();

  vassert(entry.id === undefined || Entry.isValidId(entry.id));
  vassert(entry.feed === undefined || Feed.isValidId(entry.feed));
  vassert(entry.urls === undefined || Array.isArray(entry.urls));
  vassert(
      entry.readState === undefined || entry.readState === Entry.READ ||
      entry.readState === Entry.UNREAD);
  vassert(
      entry.archiveState === undefined ||
      entry.archiveState === Entry.ARCHIVED ||
      entry.archiveState === Entry.UNARCHIVED);
  vassert(entry.author === undefined || typeof entry.author === 'string');
  vassert(entry.content === undefined || typeof entry.content === 'string');

  vassert(is_valid_date(entry.dateCreated));
  vassert(is_date_lte(entry.dateCreated, now));
  vassert(is_valid_date(entry.dateUpdated));
  vassert(is_date_lte(entry.dateUpdated, now));
  vassert(is_date_lte(entry.dateCreated, entry.dateUpdated));
  vassert(is_valid_date(entry.datePublished));
  vassert(is_date_lte(entry.datePublished, now));
  validate_enclosure(entry.enclosure);
}

// Validate the enclosure property of a feed
function validate_enclosure(enc) {
  if (enc === undefined || enc === null) {
    return;
  }

  vassert(typeof enc === 'object');
  vassert(
      enc.url === undefined || enc.url === null || typeof enc.url === 'string');
  vassert(
      enc.enclosureLength === undefined || enc.enclosureLength === null ||
      typeof enc.enclosureLength === 'string');
  vassert(
      enc.type === undefined || enc.type === null ||
      typeof enc.type === 'string');
}
