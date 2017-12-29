import assert from "/src/common/assert.js";
import {unwrapElement} from "/src/common/dom-utils.js";

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
