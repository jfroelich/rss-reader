import {assert} from '/src/lib/assert.js';
import * as html_utils from '/src/lib/html-utils.js';
import * as string_utils from '/src/lib/string-utils.js';
import {Feed} from '/src/model/feed.js';
import * as magic from '/src/model/magic.js';
import {append_url_common, is_date_lte, is_valid_date, vassert} from '/src/model/utils.js';

// TODO: consider a getter/setter on virtual property url instead of the append
// and getURLString methods. But how does that work with idb serialization?
// TODO: explicitly enumerate field definitions in constructor

export function Entry() {
  this.magic = magic.ENTRY_MAGIC;
}

Entry.INVALID_ID = 0;
Entry.UNREAD = 0;
Entry.READ = 1;
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;

Entry.prototype.appendURL = function(url) {
  assert(is_entry(this));
  return append_url_common(this, url);
};

// Returns the last url in this entry's url list
Entry.prototype.getURLString = function() {
  assert(is_entry(this));
  assert(Entry.prototype.hasURL.call(this));
  return this.urls[this.urls.length - 1];
};

Entry.prototype.hasURL = function() {
  assert(is_entry(this));
  return Array.isArray(this.urls) && this.urls.length;
};

// static-like method
Entry.isValidId = function(value) {
  return Number.isInteger(value) && value > 0;
};

Entry.sanitize = function(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  assert(is_entry(entry));

  if (entry.author) {
    let author = entry.author;
    author = string_utils.filter_controls(author);
    author = html_utils.replace_tags(author, '');
    author = string_utils.condense_whitespace(author);
    author = html_utils.truncate_html(author, author_max_length);
    entry.author = author;
  }

  if (entry.content) {
    let content = entry.content;
    // We cannot use filter_controls because that matches \r\n. This was
    // previously the source of a bug
    content = string_utils.filter_unprintables(content);

    // Temporarily disabled while debugging poll-feeds issue
    // TODO: re-enable
    // content = html_utils.truncate_html(content, content_max_length);
    entry.content = content;
  }

  if (entry.title) {
    let title = entry.title;
    title = string_utils.filter_controls(title);
    title = html_utils.replace_tags(title, '');
    title = string_utils.condense_whitespace(title);
    title = html_utils.truncate_html(title, title_max_length);
    entry.title = title;
  }
};

Entry.validate = function(entry) {
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
};

export function is_entry(value) {
  return value && typeof value === 'object' &&
      value.magic === magic.ENTRY_MAGIC;
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