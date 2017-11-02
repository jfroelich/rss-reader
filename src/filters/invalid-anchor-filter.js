'use strict';

// import base/errors.js

function invalidAnchorFilter(doc) {
  console.assert(doc instanceof Document);

  // Restrict to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(invalidAnchorFilterIsInvalid(anchor)) {
      anchor.remove();
    }
  }

  return RDR_OK;
}

function invalidAnchorFilterIsInvalid(anchor) {
  const hrefValue = anchor.getAttribute('href');
  return hrefValue && /^\s*https?:\/\/#/i.test(hrefValue);
}
