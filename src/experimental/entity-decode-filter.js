import assert from "/src/assert/assert.js";

export function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}
