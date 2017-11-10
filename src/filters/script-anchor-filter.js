'use strict';

// import filters/filter-helpers.js
// import rbl.js
// import url.js

function scriptAnchorFilter(doc) {
  assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(hasScriptProtocol(anchor.getAttribute('href'))) {
      domUnwrap(anchor);
    }
  }
}
