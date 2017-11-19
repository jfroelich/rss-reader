
import assert from "/src/utils/assert.js";

export function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}
