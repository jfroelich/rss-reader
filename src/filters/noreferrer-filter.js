// Specifies that all links are noreferrer

import assert from "/src/assert.js";

// TODO: this function's behavior conflicts with attribute filter. Need to whitelist this attribute
// (and this value) for this element.
export default function filter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.getElementsByTagName('a');
  for(const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}
