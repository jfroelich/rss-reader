'use strict';

// import base/assert.js
// import filters/filter-helpers.js

function condenseTagnamesFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  // Use shorter names for common elements
  // Because we are stripping attributes, there is no need to keep them
  // TODO: make copyAttributes a parameter
  const copyAttributes = false;
  renameElements(doc.body, 'strong', 'b', copyAttributes);
  renameElements(doc.body, 'em', 'i', copyAttributes);
}
