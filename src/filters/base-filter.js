
import assert from "/src/assert.js";

export default function filterDocument(doc) {
  assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
}
