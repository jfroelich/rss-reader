'use strict';

// import base/assert.js
// import filters/filter-helpers.js

function hidden_filter(doc) {
  ASSERT(doc instanceof Document)
  const body = doc.body;

  // Restrict analysis to body descendants
  if(!body) {
    return;
  }

  // TODO: describe body.contains call here in comments
  // TODO: describe querySelectorAll over getElementsByTagName choice
  // TODO: optimize recursive unwrap

  const elements = body.querySelectorAll('*');
  for(const element of elements) {
    if(body.contains(element) && element_is_hidden(element)) {
      unwrap_element(element);
    }
  }
}
