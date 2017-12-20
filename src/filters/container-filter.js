import assert from "/src/assert/assert.js";
import unwrapElement from "/src/utils/dom/unwrap-element.js";

// Unwraps non-semantic container-like elements
export default function filterDocument(document) {
  assert(document instanceof Document);
  if(document.body) {
    const elements = document.body.querySelectorAll('div, ilayer, layer');
    for(const element of elements) {
      unwrapElement(element);
    }
  }
}
