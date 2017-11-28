import unwrapElements from "/src/dom/unwrap-elements.js";
import assert from "/src/assert/assert.js";

// Unwraps non-semantic container-like elements from a document
export default function filterDocument(document) {
  assert(document instanceof Document);
  if(!document.body) {
    return;
  }

  unwrapElements(document.body, 'div, ilayer, layer');
}
