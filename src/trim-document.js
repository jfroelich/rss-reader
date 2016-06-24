// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Remove trimmable nodes from the start and end of the document.
function trimDocument(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const TRIMMABLE_VOID_ELEMENT_NAMES = {
    'BR': 1,
    'HR': 1,
    'NOBR': 1
  };

  const firstChild = bodyElement.firstChild;
  if(firstChild) {
    removeStep(firstChild, 'nextSibling');
    const lastChild = bodyElement.lastChild;
    if(lastChild && lastChild !== firstChild) {
      removeStep(bodyElement.lastChild, 'previousSibling');
    }
  }

  function removeStep(startNode, step) {
    let node = startNode;
    while(node && (node.nodeName in TRIMMABLE_VOID_ELEMENT_NAMES ||
      (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()))) {
      let sibling = node[step];
      node.remove();
      node = sibling;
    }
  }
}
