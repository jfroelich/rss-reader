import {assert} from '/src/lib/assert.js';
import * as magic from '/src/model/magic.js';
import * as utils from '/src/model/utils.js';

export class Feed {
  constructor() {
    this.magic = magic.FEED_MAGIC;
  }

  appendURL(url) {
    assert(is_feed(this));
    return utils.append_url_common(this, url);
  }

  getURLString() {
    assert(is_feed(this));
    assert(Feed.prototype.hasURL.call(this));
    return this.urls[this.urls.length - 1];
  }

  hasURL() {
    assert(is_feed(this));
    return Array.isArray(this.urls) && this.urls.length;
  }

  static isValidId(value) {
    return Number.isInteger(value) && value > 0;
  }
}

Feed.INVALID_ID = 0;

export function is_feed(value) {
  return typeof value === 'object' && value.magic === magic.FEED_MAGIC;
}
