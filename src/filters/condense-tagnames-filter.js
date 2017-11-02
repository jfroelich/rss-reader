'use strict';

// import base/errors.js
// import filters/filter-helpers.js

function condenseTagnamesFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  // Use shorter names for common elements
  // Because we are stripping attributes, there is no need to keep them
  // TODO: make copyAttributes a parameter
  const copyAttributes = false;
  renameElements(doc.body, 'strong', 'b', copyAttributes);
  renameElements(doc.body, 'em', 'i', copyAttributes);
  return RDR_OK;
}
