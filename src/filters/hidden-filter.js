'use strict';

// import base/assert.js
// import filters/filter-helpers.js
// import dom.js

// TODO: make a github issue about optimizing recursive unwrap
function hiddenFilter(doc) {
  assert(doc instanceof Document)
  const body = doc.body;

  // Restrict analysis to body descendants
  if(!body) {
    return;
  }

  // contains is called to avoid removing descendants of elements detached in
  // prior iterations.
  // querySelectorAll is used over getElementsByTagName to simplify removal
  // during iteration.

  const elements = body.querySelectorAll('*');
  for(const element of elements) {
    if(body.contains(element) && domIsHiddenInline(element)) {
      domUnwrap(element);
    }
  }
}
