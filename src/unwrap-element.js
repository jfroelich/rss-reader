// See license.md
'use strict';

// TODO: i think i would like to simplify this back into the single parameter
// function, and add a separate function for a more complex unwrap_into
// scenario.
// TODO: the padding is a rather gross asssumption of the caller's requirements.
// To lessen the impact of the assumption it would be better if the decision of
// whether to add padding as a result is a parameter to the function.

function unwrap_element(element, reference_node) {
  const target_element = reference_node || element;
  const parent_element = target_element.parentNode;

  if(!parent_element)
    throw new TypeError('missing parent_element element');

  const doc = element.ownerDocument;
  const prev_sibling = target_element.previousSibling;
  if(prev_sibling && prev_sibling.nodeType === Node.TEXT_NODE)
    parent_element.insertBefore(doc.createTextNode(' '), target_element);

  insert_children_before(element, target_element);

  const next_sibling = target_element.nextSibling;
  if(next_sibling && next_sibling.nodeType === Node.TEXT_NODE)
    parent_element.insertBefore(doc.createTextNode(' '), target_element);
  target_element.remove();
}

// NOTE: leave in global scope for now due to some odd dependencies
function insert_children_before(parent_node, reference_node) {
  const ref_parent = reference_node.parentNode;
  for(let node = parent_node.firstChild; node; node = parent_node.firstChild)
    ref_parent.insertBefore(node, reference_node);
}
