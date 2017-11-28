import unwrap from "/src/dom/unwrap-element.js";
import assert from "/src/assert/assert.js";

// Transforms noscript content in document content

export default function filterDocument(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrap(noscript);
  }
}
