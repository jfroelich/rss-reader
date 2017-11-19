// Filters certain breakrule elements from document content

import assert from "/src/utils/assert.js";

export default function filter(doc) {
  assert(doc instanceof Document);
  if(doc.body) {
    const brs = doc.body.querySelectorAll('br + br');
    for(const br of brs) {
      br.remove();
    }
  }
}
