import assert from "/src/assert/assert.js";

// Filters certain breakrule elements from document content
export default function filter(doc) {
  assert(doc instanceof Document);
  if(doc.body) {
    const brs = doc.body.querySelectorAll('br + br');
    for(const br of brs) {
      br.remove();
    }
  }
}
