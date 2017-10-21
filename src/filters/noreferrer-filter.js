'use strict';

// import base/assert.js
// import base/status.js

// TODO: this conflicts with attribute filter. Need to whitelist this
// attribute and this value for this element.
function noreferrer_filter(doc) {
  ASSERT(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.getElementsByTagName('a');
  for(const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }

  return STATUS_OK;
}
