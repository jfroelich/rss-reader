'use strict';

// Dependencies:
// assert.js
// filter-helpers.js
// element.js


// Replace an element with its children. Special care is taken to add spaces
// if the operation would result in adjacent text nodes.
function unwrap_element(element) {
  const parent_element = element.parentNode;

  // The caller is responsible for only calling unwrap on elements that have
  // a parent
  ASSERT(parent_element, 'Cannot unwrap orphaned element');

  const prev_sibling = element.previousSibling;
  const next_sibling = element.nextSibling;
  const first_child = element.firstChild;
  const last_child = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Leading padding
  if(prev_sibling && prev_sibling.nodeType === TEXT &&
    first_child && first_child.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children up
  for(let node = first_child; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Trailing padding
  if(last_child && first_child !== last_child && next_sibling &&
    next_sibling.nodeType === TEXT && last_child.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If next_sibling is undefined then insertBefore appends
  return parent_element.insertBefore(frag, next_sibling);
}

function unwrap_elements(ancestor_element, selector) {
  if(ancestor_element && selector) {
    const elements = ancestor_element.querySelectorAll(selector);
    for(const element of elements)
      unwrap_element(element);
  }
}

// TODO: left this in global scope for now due to some odd dependencies. Remove
// the dependencies. Inline this function
function insert_children_before(parent_node, reference_node) {
  const ref_parent = reference_node.parentNode;
  for(let node = parent_node.firstChild; node; node = parent_node.firstChild)
    ref_parent.insertBefore(node, reference_node);
}

// Changes the tag name of an element. Event listeners are lost on rename. No
// checking is done regarding whether the result is semantically correct.
//
// See https://stackoverflow.com/questions/15408394 for a basic explanation of
// why event listeners are lost on rename.
//
// @param copy_attrs {Boolean} optional, if true then attributes are maintained,
// defaults to true.
// @returns {Element} the new element that replaced the old one
function rename_element(element, new_element_name, copy_attrs) {

  // According to MDN docs, createElement(null) works like createElement("null")
  // so to avoid that treat missing name as an error
  ASSERT(typeof new_element_name === 'string');
  ASSERT(!new_element_name.includes(' '));

  if(typeof copy_attrs === 'undefined')
    copy_attrs = true;

  // Treat attempting to rename an element to the same name as a noop
  if(element.localName === new_element_name.toLowerCase())
    return element;

  const parent_element = element.parentNode;
  if(!parent_element)
    return element;

  // Use next sibling to record position prior to detach. May be undefined.
  const next_sibling = element.nextSibling;

  // Detach the existing node, prior to performing other dom operations, so that
  // the other operations take place on a detached node. Implicitly, this sets
  // parentNode and nextSibling to undefined.
  element.remove();

  // Create the replacement
  const new_element = element.ownerDocument.createElement(new_element_name);

  if(copy_attrs) {
    element_copy_attributes(element, new_element);
  }

  // Move children
  // There does not appear to be a batch node move operation available in the
  // dom api. I spent some time looking and trying to come up with clever
  // alternatives, such as to_element.innerHTML = from_element.innerHTML, but
  // nothing was better.
  let child_node = element.firstChild;
  while(child_node) {
    new_element.appendChild(child_node);
    child_node = element.firstChild;
  }

  // Attach the new element in place of the old element
  // If next_sibling is undefined then insertBefore simply appends
  // Returns the new element
  return parent_element.insertBefore(new_element, next_sibling);
}

function rename_elements(ancestor_element, old_element_name, new_element_name,
  copy_attrs) {
  if(ancestor_element) {
    const elements = ancestor_element.querySelectorAll(old_element_name);
    for(const element of elements)
      rename_element(element, new_element_name, copy_attrs);
  }
}
