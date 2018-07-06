import assert from '/src/lib/assert.js';
import * as bp from '/src/lib/boilerplate2.js';

// TODO: what if i change annotate to classify, make annotation an option,
// and have classify yield the blocks array instead of undefined, then this
// does iteration over the blocks array. That way I leave annotation
// false here in production, and there is not even a need to cleanup
// attributes or even do any dom-writes. I don't even need to query for
// attributes I can just iterate over the blocks array.

// NOT YET TESTED

export function filter_boilerplate(document) {
  assert(document);

  // Classify content using default options
  // We do not annotate because these attributes will not be used
  const blocks = bp.classify(document, {annotate: false});

  for (const block of blocks) {
    if (block.isBoilerplate()) {
      block.element.remove();
    }
  }
}
