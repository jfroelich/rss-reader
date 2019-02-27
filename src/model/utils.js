import {assert} from '/src/lib/assert.js';
import * as magic from '/src/model/magic.js';

export function append_url_common(object, url) {
  assert(typeof object === 'object');
  assert(
      object.magic === magic.FEED_MAGIC || object.magic === magic.ENTRY_MAGIC);
  assert(url instanceof URL);

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
