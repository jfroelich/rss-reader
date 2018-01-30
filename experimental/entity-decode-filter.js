import assert from '/src/common/assert.js';

export function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if (!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}
