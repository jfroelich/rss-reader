import is_valid_id from '/src/db/is-valid-id.js';
import assert from '/src/lib/assert.js';

export function identifiable_test() {
  assert(!is_valid_id(-1));
  assert(!is_valid_id(0));
  assert(!is_valid_id('hello'));
  assert(!is_valid_id(true));
  assert(!is_valid_id(false));
  assert(is_valid_id(1));
  assert(is_valid_id(123456789));
}
