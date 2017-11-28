import assert from "/src/assert/assert.js";

// Remove all base elements from a document
export default function filterDocument(doc) {
  assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
}
