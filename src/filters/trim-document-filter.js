'use strict';

// import base/assert.js
// import base/status.js

// Remove whitespace and whitespace-like content from the start and end of
// a document's body.
function trim_document_filter(doc) {
  ASSERT(doc instanceof Document);

  if(!doc.body) {
    return STATUS_OK;
  }

  const first_child = doc.body.firstChild;
  if(first_child) {
    // Trim from the front
    trim_document_filter_step(first_child, 'nextSibling');

    // Trim from the back
    const last_child = doc.body.lastChild;
    if(last_child && last_child !== first_child) {
      trim_document_filter_step(last_child, 'previousSibling');
    }
  }

  return STATUS_OK;
}

function trim_document_filter_step(starting_node, edge_prop_name) {
  let node = starting_node;
  while(trim_document_filter_is_trimmable(node)) {
    const sibling = node[edge_prop_name];
    node.remove();
    node = sibling;
  }
}

function trim_document_filter_is_trimmable(node) {
  const elements = ['br', 'hr', 'nobr'];
  return node && (elements.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}
