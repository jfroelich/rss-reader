'use strict';

// This lib contains helpers for document transforms

// Replace an element with its children. Special care is taken to add spaces
// if the operation would result in adjacent text nodes.
function unwrap_element(element) {
  const parent_element = element.parentNode;
  if(!parent_element)
    throw new TypeError('Cannot unwrap orphaned element', element.outerHTML);
  const prev_sibling = element.previousSibling;
  const next_sibling = element.nextSibling;
  const first_child = element.firstChild;
  const last_child = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();
  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();
  if(prev_sibling && prev_sibling.nodeType === TEXT &&
    first_child && first_child.nodeType === TEXT)
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  for(let node = first_child; node; node = element.firstChild)
    frag.appendChild(node);
  if(last_child && first_child !== last_child && next_sibling &&
    next_sibling.nodeType === TEXT && last_child.nodeType === TEXT)
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  // If next_sibling is undefined then insertBefore appends
  parent_element.insertBefore(frag, next_sibling);
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
// @param copy_attrs {Boolean} optional, if true then attributes are maintained,
// defaults to true.
// @returns {Element} the new element that replaces the old one
function rename_element(element, new_element_name, copy_attrs) {
  if(typeof copy_attrs === 'undefined')
    copy_attrs = true;
  if(!new_element_name)
    throw new TypeError('new_element_name is falsy');
  // Treat attempting to rename an element to the same name as a noop instead
  // of as an error for caller convenience.
  if(element.localName === new_element_name.trim().toLowerCase())
    return;

  const parent_element = element.parentNode;
  if(!parent_element)
    return;
  const next_sibling = element.nextSibling;
  element.remove();
  const new_element = element.ownerDocument.createElement(new_element_name);

  if(copy_attrs) {
    const attrs = element.attributes;
    for(let i = 0, length = attrs.length; i < length; i++) {
      const attr = attrs[i];
      new_element.setAttribute(attr.name, attr.value);
    }
  }

  let child_node = element.firstChild;
  while(child_node) {
    new_element.appendChild(child_node);
    child_node = element.firstChild;
  }

  // If next_sibling is undefined then insertBefore simply appends
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

function is_hidden_element(element) {
  return element.hasAttribute('style') &&
    (element.style.display === 'none' ||
     element.style.visibility === 'hidden' ||
     (element.style.position === 'absolute' &&
      parseInt(element.style.left, 10) < 0));
}
