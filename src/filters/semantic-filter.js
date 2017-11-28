import unwrapElements from "/src/dom/unwrap-elements.js";
import assert from "/src/assert/assert.js";

// Filter semantic web elements from document content

export default function filter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'article, aside, footer, header, main, section');
}
