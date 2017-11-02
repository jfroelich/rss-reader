'use strict';

// import base/errors.js

// TODO: this function's behavior conflicts with attribute filter. Need to
// whitelist this attribute (and this value) for this element.
function noreferrerFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.getElementsByTagName('a');
  for(const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }

  return RDR_OK;
}
