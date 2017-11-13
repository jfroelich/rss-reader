
import assert from "/src/assert.js";

export function pingFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[ping]');
  for(const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}
