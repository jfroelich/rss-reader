import assert from '/src/assert/assert.js';
import * as types from '/src/db/types.js';

// TODO: decouple from assert
// TODO: inline append_url_common (artifact of old model.js)

export function create_feed() {
  return {magic: types.FEED_MAGIC};
}

export function is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function append_feed_url(feed, url) {
  assert(types.is_feed(feed));
  return append_url_common(feed, url);
}

function append_url_common(object, url) {
  assert(typeof url.href === 'string');

  const normal_url_string = url.href;
  if (object.urls) {
    if (object.urls.includes(normal_url_string)) {
      return false;
    }

    object.urls.push(normal_url_string);
  } else {
    object.urls = [normal_url_string];
  }

  return true;
}
