// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function trimDocument(document) {
  const body = document.body;
  if(!body) {
    return;
  }

  const firstChild = body.firstChild;
  if(firstChild) {
    step(firstChild, 'nextSibling');
    const lastChild = body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      step(lastChild, 'previousSibling');
    }
  }
}

const TRIMMABLE_ELEMENTS = {
  'br': 1,
  'hr': 1,
  'nobr': 1
};

function isTrimmable(node) {
  return node && (node.localName in TRIMMABLE_ELEMENTS ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

function step(start_node, prop_name) {
  let node = start_node;
  while(isTrimmable(node)) {
    let sibling = node[prop_name];
    node.remove();
    node = sibling;
  }
}

this.trimDocument = trimDocument;

} // End file block scope
