import {assert} from '/src/lib/assert.js';
import * as magic from '/src/model/magic.js';
import * as utils from '/src/model/utils.js';

export class Entry {
  constructor() {
    this.magic = magic.ENTRY_MAGIC;
  }

  appendURL(url) {
    assert(is_entry(this));
    return utils.append_url_common(this, url);
  }

  // Returns the last url in this entry's url list
  getURLString() {
    assert(is_entry(this));
    assert(Entry.prototype.hasURL.call(this));
    return this.urls[this.urls.length - 1];
  }

  hasURL() {
    assert(is_entry(this));
    return Array.isArray(this.urls) && this.urls.length;
  }

  static isValidId(value) {
    return Number.isInteger(value) && value > 0;
  }
}

Entry.INVALID_ID = 0;
Entry.UNREAD = 0;
Entry.READ = 1;
Entry.UNARCHIVED = 0;
Entry.ARCHIVED = 1;

export function is_entry(value) {
  return typeof value === 'object' && value.magic === magic.ENTRY_MAGIC;
}
