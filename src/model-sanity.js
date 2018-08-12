import assert from '/src/lib/assert.js';
import * as html from '/src/lib/html.js';
import * as string from '/src/lib/string.js';
import * as Model from '/src/model.js';

export function validate_entry(entry) {
  assert(Model.is_entry(entry));
  const now = new Date();

  vassert(entry.id === undefined || Model.is_valid_entry_id(entry.id));
  vassert(entry.feed === undefined || Model.is_valid_feed_id(entry.feed));
  vassert(entry.urls === undefined || Array.isArray(entry.urls));
  vassert(
      entry.readState === undefined ||
      entry.readState === Model.ENTRY_STATE_READ ||
      entry.readState === Model.ENTRY_STATE_UNREAD);
  vassert(
      entry.archiveState === undefined ||
      entry.archiveState === Model.ENTRY_STATE_ARCHIVED ||
      entry.archiveState === Model.ENTRY_STATE_UNARCHIVED);
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

function is_valid_date(value) {
  return value === undefined || !isNaN(value.getTime());
}

function is_date_lte(date1, date2) {
  return date1 === undefined || date2 === undefined || date1 <= date2;
}

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

export function validate_feed(feed) {
  assert(Model.is_feed(feed));
  const now = new Date();

  vassert(feed.id === undefined || Model.is_valid_feed_id(feed.id));
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
      feed.deactivationReasonText === undefined ||
      typeof feed.deactivationReasonText === 'string');

  vassert(is_valid_date(feed.deactivateDate));
  vassert(is_date_lte(feed.deactivateDate, now));
  vassert(is_valid_date(feed.dateCreated));
  vassert(is_date_lte(feed.dateCreated, now));
  vassert(is_date_lte(feed.dateCreated, feed.deactivateDate));
  vassert(is_valid_date(feed.dateUpdated));
  vassert(is_date_lte(feed.dateUpdated, now));
  vassert(is_date_lte(feed.dateCreated, feed.dateUpdated));
  vassert(is_valid_date(feed.datePublished));
  vassert(is_date_lte(feed.datePublished, now));
  vassert(is_valid_date(feed.dateLastModifed));
  vassert(is_date_lte(feed.dateLastModifed, now));
  vassert(is_valid_date(feed.dateFetched));
  vassert(is_date_lte(feed.dateFetched, now));
}

export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  assert(Model.is_entry(entry));

  if (entry.author) {
    let author = entry.author;
    author = string.filter_controls(author);
    author = html.replace_tags(author, '');
    author = string.condense_whitespace(author);
    author = html.truncate_html(author, author_max_length);
    entry.author = author;
  }

  if (entry.content) {
    let content = entry.content;
    // We cannot use filter_controls because that matches \r\n. This was
    // previously the source of a bug
    content = string.filter_unprintables(content);
    content = html.truncate_html(content, content_max_length);
    entry.content = content;
  }

  if (entry.title) {
    let title = entry.title;
    title = string.filter_controls(title);
    title = html.replace_tags(title, '');
    title = string.condense_whitespace(title);
    title = html.truncate_html(title, title_max_length);
    entry.title = title;
  }
}

export function sanitize_feed(feed, title_max_len, desc_max_len) {
  assert(Model.is_feed(feed));

  if (isNaN(title_max_len)) {
    title_max_len = 1024;
  }

  if (isNaN(desc_max_len)) {
    desc_max_len = 10240;
  }

  const html_tag_replacement = '';
  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = string.filter_controls(title);
    title = html.replace_tags(title, html_tag_replacement);
    title = string.condense_whitespace(title);
    title = html.truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = string.filter_controls(desc);
    desc = html.replace_tags(desc, html_tag_replacement);
    desc = string.condense_whitespace(desc);
    desc = html.truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}

function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation error') {
    super(message);
  }
}
