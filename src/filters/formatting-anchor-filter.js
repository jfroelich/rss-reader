import assert from "/src/assert/assert.js";
import unwrap from "/src/dom/unwrap-element.js";

// Filters certain anchor elements from document content

// An anchor that acts like a span can be unwrapped. Currently misses anchors that have href attr
// but is empty/whitespace
export default function filter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(!anchor.hasAttribute('href')) {
      unwrap(anchor);
    }
  }
}
