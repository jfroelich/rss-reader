import assert from "/src/assert.js";

// TODO: this should be part of a general character normalization filter, or perhaps a whitespace
// normalization filter, or an entity filter
// TODO: accessing nodeValue does decoding, so maybe this doesn't work? Forgot.
// TODO: this needs testing to test whether it actually works, I don't think this works, because
// of how entities are decoded when accessing nodeValue

export function hairspaceFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const newValue = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(newValue.length !== value.length) {
      node.nodeValue = newValue;
    }
  }
}
