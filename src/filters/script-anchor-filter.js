'use strict';

// import base/assert.js
// import base/errors.js
// import filters/filter-helpers.js
// import net/url-utils.js

function scriptAnchorFilter(doc) {
  assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(URLUtils.hasScriptProtocol(anchor.getAttribute('href'))) {
      domUnwrap(anchor);
    }
  }

  return RDR_OK;
}
