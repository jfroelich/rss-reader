// Unwraps container-like elements from a document

import assert from "/src/utils/assert.js";
import {unwrapElements} from "/src/filters/filter-helpers.js";

export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'div, ilayer, layer');
}
