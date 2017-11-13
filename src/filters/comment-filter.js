
import assert from "/src/assert.js";

export function commentFilter(doc) {
  assert(doc instanceof Document);
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}
