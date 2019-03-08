import {assert} from '/src/assert.js';
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

export function is_valid_date(value) {
  return value === undefined || !isNaN(value.getTime());
}

export function is_date_lte(date1, date2) {
  return date1 === undefined || date2 === undefined || date1 <= date2;
}

// An assertion-like utility for throwing validation errors
export function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation error') {
    super(message);
  }
}
