// Unwraps container-like elements from a document

import {unwrapElements} from "/src/dom/utils.js";
import assert from "/src/utils/assert.js";

export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'div, ilayer, layer');
}
