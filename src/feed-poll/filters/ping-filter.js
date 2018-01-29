import assert from "/src/common/assert.js";

// TODO: move to basic filters

// Removes ping attributes from anchor elements in document content
export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[ping]');
  for(const anchor of anchors) {
    anchor.removeAttribute('ping');
  }
}
