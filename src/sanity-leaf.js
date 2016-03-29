// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes leaf-like elements from the document. A leaf element is basically
// an empty element.
// Because DOM modification is expensive, this tries to minimize the number
// of elements removed by only removing the shallowest elements.
// This still traverses all of the elements, because using querySelectorAll is
// faster than walking.
function sanity_filter_leaves(document) {
  'use strict';

  const elements = document.querySelectorAll('*');
  const numElements = elements.length;
  const docElement = document.documentElement;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element) && sanity_is_leaf(element)) {
      element.remove();
    }
  }
}

var SANITY_LEAF_EXCEPTIONS = {
  'AREA': 1, 'AUDIO': 1, 'BASE': 1, 'COL': 1, 'COMMAND': 1, 'BR': 1,
  'CANVAS': 1, 'COL': 1, 'HR': 1, 'IFRAME': 1, 'IMG': 1, 'INPUT': 1,
  'KEYGEN': 1, 'META': 1, 'NOBR': 1, 'PARAM': 1, 'PATH': 1, 'SOURCE': 1,
  'SBG': 1, 'TEXTAREA': 1, 'TRACK': 1, 'VIDEO': 1, 'WBR': 1
};

function sanity_is_leaf(element) {
  'use strict';

  if(element.nodeName in SANITY_LEAF_EXCEPTIONS) {
    return false;
  }

  const TEXT_NODE = Node.TEXT_NODE, ELEMENT_NODE = Node.ELEMENT_NODE;

  for(let node = element.firstChild; node; node = node.nextSibling) {
    switch(node.nodeType) {
      case TEXT_NODE:
        if(node.nodeValue.trim()) {
          return false;
        }
        break;
      case ELEMENT_NODE:
        if(!sanity_is_leaf(node)) {
          return false;
        }
        break;
      default:
        return false;
    }
  }

  return true;
}
