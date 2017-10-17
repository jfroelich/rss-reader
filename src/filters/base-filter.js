// base element handling

'use strict';

// Dependencies:
// none

// Removes all base elements from the document
function base_filter(doc) {

  // Bases can be located anywhere in the document
  const base_elements = doc.querySelectorAll('base');
  for(const base_element of base_elements) {
    base_element.remove();
  }
}
