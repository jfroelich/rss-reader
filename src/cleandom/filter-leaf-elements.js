// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Removes leaf-like elements from the document
function filterLeafElements(doc) {

  const body = doc.body;

  // Ensure the body is set. This works within body only to avoid blanking the
  // entire document if body is a leaf. If there is no body then there is
  // nothing to do.
  if(!body) {
    return;
  }

  const docElement = doc.documentElement;
  const elements = body.querySelectorAll('*');

  // Not using for..of due to V8 deopt warning about try/catch

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docElement.contains(element) && isLeafNode(element)) {
      element.remove();
    }
  }
}
