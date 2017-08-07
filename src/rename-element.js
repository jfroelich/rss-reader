// See license.md
'use strict';

{ // Begin file block scope

function rename_element(element, new_element_name, is_ignore_attrs) {
  if(typeof new_element_name !== 'string')
    throw new TypeError('new_element_name is not a string');
  if(!new_element_name.length)
    throw new TypeError('new_element_name is empty');
  if(element.localName === new_element_name.toLowerCase())
    return;
  const parent_element = element.parentNode;
  if(!parent_element)
    return;
  const next_node = element.nextSibling;// may be undef, that is ok
  element.remove();
  const new_element = element.ownerDocument.createElement(new_element_name);
  if(!is_ignore_attrs)
    copy_element_attributes(element, new_element);
  move_child_nodes(element, new_element);
  parent_element.insertBefore(new_element, next_node);
}

function copy_element_attributes(from_element, to_element) {
  const attrs = from_element.attributes;
  for(let i = 0, length = attrs.length; i < length; i++) {
    const attr = attrs[i];
    to_element.setAttribute(attr.name, attr.value);
  }
}

function move_child_nodes(from_element, to_element) {
  let child_node = from_element.firstChild;
  while(child_node) {
    to_element.appendChild(child_node);
    child_node = from_element.firstChild;
  }
}

this.rename_element = rename_element;

} // End file block scope
