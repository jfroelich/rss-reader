// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Removes leaf-like elements from the document
function filter_leaf_elements(doc) {
  if(!doc.body) {
    return;
  }

  const doc_element = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');

  // Not using for..of due to V8 deopt warning about try/catch

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(doc_element.contains(element) && is_leaf_node(element)) {
      element.remove();
    }
  }
}
