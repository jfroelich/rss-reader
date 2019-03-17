import * as magic from '/src/db/magic.js';
import {append_url_common} from '/src/db/utils.js';
import assert from '/src/lib/assert.js';

export function Feed() {
  this.magic = magic.FEED_MAGIC;
}

Feed.INVALID_ID = 0;

Feed.prototype.appendURL = function(url) {
  assert(is_feed(this));
  return append_url_common(this, url);
};

Feed.prototype.getURLString = function() {
  assert(is_feed(this));
  assert(Feed.prototype.hasURL.call(this));
  return this.urls[this.urls.length - 1];
};

Feed.prototype.hasURL = function() {
  assert(is_feed(this));
  return Array.isArray(this.urls) && this.urls.length;
};

Feed.isValidId = function(value) {
  return Number.isInteger(value) && value > 0;
};

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === magic.FEED_MAGIC;
}
