'use strict';

// import filters/filter-helpers.js
// import rbl.js

// Use shorter names for common elements
function condenseTagnamesFilter(doc, copyAttributes) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  renameElements(doc.body, 'strong', 'b', copyAttributes);
  renameElements(doc.body, 'em', 'i', copyAttributes);
}
