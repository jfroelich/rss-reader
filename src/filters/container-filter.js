// Unwraps non-semantic container-like elements from a document

import unwrapElements from "/src/dom/unwrap-elements.js";
import assert from "/src/utils/assert.js";

export default function filterDocument(document) {
  assert(document instanceof Document);
  if(!document.body) {
    return;
  }

  unwrapElements(document.body, 'div, ilayer, layer');
}
