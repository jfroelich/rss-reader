// Library for working with urls

// Dependencies
// assert.js

function url_get_hostname(url_string) {
  'use strict';
  ASSERT(url_string);
  try {
    const url_object = new URL(url_string);
    return url_object.hostname;
  } catch(error) {
  }
}


// Only minor validation for speed
// Assumes canonical/absolute
// TODO: add min length check
function url_is_valid(url_string) {
  'use strict';
  return url_string && !url_string.trim().includes(' ');
}
