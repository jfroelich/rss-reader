// Transforms noscript content in document content

import unwrap from "/src/dom/unwrap-element.js";
import assert from "/src/assert.js";

export default function filterDocument(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrap(noscript);
  }
}
