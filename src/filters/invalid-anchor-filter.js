'use strict';

// import rbl.js

function invalidAnchorFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(invalidAnchorFilterIsInvalid(anchor)) {
      anchor.remove();
    }
  }
}

function invalidAnchorFilterIsInvalid(anchor) {
  const hrefValue = anchor.getAttribute('href');
  return hrefValue && /^\s*https?:\/\/#/i.test(hrefValue);
}
