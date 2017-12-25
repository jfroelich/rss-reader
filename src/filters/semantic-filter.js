import assert from "/src/utils/assert.js";
import unwrapElement from "/src/utils/dom/unwrap-element.js";

// Filter semantic web elements from document content
export default function filter(document) {
  assert(document instanceof Document);
  if(document.body) {
    const selector = 'article, aside, footer, header, main, section';
    const elements = document.body.querySelectorAll(selector);
    for(const element of elements) {
      unwrapElement(element);
    }
  }
}
