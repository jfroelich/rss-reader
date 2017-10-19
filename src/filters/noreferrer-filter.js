'use strict';

// import assert.js

// TODO: this conflicts with attribute filter. Need to whitelist this
// attribute and this value for this element.
function noreferrer_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const anchors = doc.body.getElementsByTagName('a');
  for(const anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}
