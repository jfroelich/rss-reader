'use strict';

// Dependencies:
// assert.js
// filter-helpers.js

function condense_tagnames_filter(doc) {
  ASSERT(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  // TODO: are there other elements with abbreviated versions like strong/em?

  // Use shorter names for common elements
  // Because we are stripping attributes, there is no need to keep them
  const copy_attributes = false;
  rename_elements(doc.body, 'strong', 'b', copy_attributes);
  rename_elements(doc.body, 'em', 'i', copy_attributes);

}
