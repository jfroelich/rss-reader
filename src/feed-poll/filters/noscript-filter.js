import assert from "/src/common/assert.js";
import {unwrapElement} from "/src/common/dom-utils.js";

// Transforms noscript content in document content
export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const noscripts = doc.body.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrapElement(noscript);
  }
}
