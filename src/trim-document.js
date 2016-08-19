// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.trim_document = function(document) {
  const body = document.body;
  if(!body) {
    return;
  }

  const firstChild = body.firstChild;
  if(firstChild) {
    step(firstChild, 'nextSibling');
    const lastChild = body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      step(body.lastChild, 'previousSibling');
    }
  }
};

const TRIMMABLE_ELEMENTS = {
  'br': 1,
  'hr': 1,
  'nobr': 1
};

function step(startNode, step) {
  let node = startNode;
  while(node && (node.localName in TRIMMABLE_ELEMENTS ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()))) {
    let sibling = node[step];
    node.remove();
    node = sibling;
  }
}

} // End file block scope
