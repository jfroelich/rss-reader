// See license.md
'use strict';

function unwrap_element(element, reference_node) {
  const target = reference_node || element;
  const parent = target.parentNode;

  if(!parent)
    throw new TypeError('missing parent element');

  const doc = element.ownerDocument;
  const prev_sibling = target.previousSibling;
  if(prev_sibling && prev_sibling.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);

  insert_children_before(element, target);

  const next_sibling = target.nextSibling;
  if(next_sibling && next_sibling.nodeType === Node.TEXT_NODE)
    parent.insertBefore(doc.createTextNode(' '), target);
  target.remove();
}

// NOTE: leave in global scope for now due to some odd dependencies
function insert_children_before(parent_node, reference_node) {
  const ref_parent = reference_node.parentNode;
  for(let node = parent_node.firstChild; node; node = parent_node.firstChild)
    ref_parent.insertBefore(node, reference_node);
}
