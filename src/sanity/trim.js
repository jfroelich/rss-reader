// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// This only examines nodes contained within the body.

function sanity_trim_document(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const firstChild = bodyElement.firstChild;
  if(firstChild) {
    sanity_remove_trimmable_nodes_by_step(firstChild, 'nextSibling');
    const lastChild = bodyElement.lastChild;
    if(lastChild && lastChild !== firstChild) {
      sanity_remove_trimmable_nodes_by_step(bodyElement.lastChild,
        'previousSibling');
    }
  }
}

const SANITY_TRIMMABLE_VOID_ELEMENTS = {
  'BR': 1,
  'HR': 1,
  'NOBR': 1
};

function sanity_remove_trimmable_nodes_by_step(startNode, step) {
  'use strict';

  const TEXT = Node.TEXT_NODE;
  let node = startNode, sibling = startNode;
  while(node && (node.nodeName in SANITY_TRIMMABLE_VOID_ELEMENTS ||
    (node.nodeType === TEXT && !node.nodeValue.trim()))) {
    sibling = node[step];
    node.remove();
    node = sibling;
  }
}
