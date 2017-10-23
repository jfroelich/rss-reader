'use strict';

// import base/status.js
// import filters/filter-helpers.js

// An anchor that acts like a span can be unwrapped
// Currently misses anchors that have href attr but is empty/whitespace
function formatting_anchor_filter(doc) {
  console.assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(!anchor.hasAttribute('href')) {
      unwrap_element(anchor);
    }
  }

  return STATUS_OK;
}
