
import {assert} from "/src/assert.js";

// @throws AssertionError
export function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}
