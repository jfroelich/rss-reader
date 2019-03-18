import * as magic from '/src/db/magic.js';
import {append_url_common} from '/src/db/utils.js';
import assert from '/src/lib/assert.js';

// TODO: explicitly enumerate fields in constructor. this was started, but
// review the fields. i found a few that were missing.

export function Entry() {
  this.magic = magic.ENTRY_MAGIC;

  // TODO: review behavior with IDBObjectStore.prototype.put and
  // properties that are keyed but undefined
  // this.id = undefined;

  this.author = undefined;
  this.title = undefined;
  this.content = undefined;
  this.readState = undefined;
  this.urls = undefined;
  this.feed = undefined;
  this.archiveState = undefined;
  this.dateCreated = undefined;
  this.dateUpdated = undefined;
  this.datePublished = undefined;
  this.enclosure = undefined;
  this.faviconURLString = undefined;
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

Entry.isValidId = function(value) {
  return Number.isInteger(value) && value > 0;
};

export function is_entry(value) {
  return value && typeof value === 'object' &&
      value.magic === magic.ENTRY_MAGIC;
}
