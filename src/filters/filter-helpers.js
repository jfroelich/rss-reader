'use strict';

// import base/errors.js
// import dom.js

function unwrap_elements(ancestor_element, selector) {
  if(ancestor_element && selector) {
    const elements = ancestor_element.querySelectorAll(selector);
    for(const element of elements) {
      dom_unwrap(element);
    }
  }

  return RDR_OK;
}

function rename_elements(ancestor_element, old_element_name, new_element_name,
  copy_attrs) {
  console.assert(typeof old_element_name === 'string');
  console.assert(typeof new_element_name === 'string');

  if(ancestor_element) {
    console.assert(ancestor_element instanceof Element);
    const elements = ancestor_element.querySelectorAll(old_element_name);
    for(const element of elements) {
      dom_rename(element, new_element_name, copy_attrs);
    }
  }

  return RDR_OK;
}
