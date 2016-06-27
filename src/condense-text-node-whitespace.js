// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Iterates text nodes in a document and condenses consecutive whitespace.
function condenseTextNodeWhitespace(document) {
  const SENSITIVE_ELEMENTS = ['code', 'pre', 'ruby', 'textarea', 'xmp'];
  const SENSITIVE_SELECTOR = SENSITIVE_ELEMENTS.join(',');
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    let value = node.nodeValue;
    if(value.length > 3 && !node.parentNode.closest(SENSITIVE_SELECTOR)) {
      let condensedValue = value.replace(/\s{2,}/g, ' ');
      if(condensedValue !== value) {
        node.nodeValue = condensedValue;
      }
    }
  }
}
