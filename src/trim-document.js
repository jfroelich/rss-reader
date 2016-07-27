// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function trimDocument(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const VOIDS = {
    'br': 1,
    'hr': 1,
    'nobr': 1
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
    while(node && (node.localName in VOIDS ||
      (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()))) {
      let sibling = node[step];
      node.remove();
      node = sibling;
    }
  }
}
