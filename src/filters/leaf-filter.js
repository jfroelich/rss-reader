'use strict';

// import base/assert.js
// import dom/element.js

function leaf_filter(doc) {
  ASSERT(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const doc_element = doc.documentElement;

  const elements = doc.body.querySelectorAll('*');
  for(const element of elements) {
    if(doc_element.contains(element) && node_is_leaf(element))
      element.remove();
  }

}
