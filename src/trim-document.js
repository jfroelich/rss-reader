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

  const first_child = body.firstChild;
  if(first_child) {
    step(first_child, 'nextSibling');
    const last_child = body.lastChild;
    if(last_child && last_child !== first_child) {
      step(last_child, 'previousSibling');
    }
  }
};

const TRIMMABLE_ELEMENTS = {
  'br': 1,
  'hr': 1,
  'nobr': 1
};

function is_trimmable(node) {
  return node && (node.localName in TRIMMABLE_ELEMENTS ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}

function step(start_node, prop_name) {
  let node = start_node;
  while(is_trimmable(node)) {
    let sibling = node[prop_name];
    node.remove();
    node = sibling;
  }
}

} // End file block scope
