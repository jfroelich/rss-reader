import * as identifiable from '/src/db/identifiable.js';
import assert from '/src/lib/assert.js';

export function is_valid_id_test() {
  assert(!identifiable.is_valid_id(-1));
  assert(!identifiable.is_valid_id(0));
  assert(!identifiable.is_valid_id('hello'));
  assert(!identifiable.is_valid_id(true));
  assert(!identifiable.is_valid_id(false));

  assert(identifiable.is_valid_id(1));
  assert(identifiable.is_valid_id(123456789));
}
