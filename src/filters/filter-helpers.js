'use strict';

// import dom.js
// import rbl.js

function unwrapElements(ancestorElement, selector) {
  assert(ancestorElement instanceof Element);
  assert(typeof selector === 'string');
  const elements = ancestorElement.querySelectorAll(selector);
  for(const element of elements) {
    domUnwrap(element);
  }
}

function renameElements(ancestorElement, oldName, newName, copyAttributes) {
  assert(typeof oldName === 'string');
  assert(typeof newName === 'string');

  if(ancestorElement) {
    assert(ancestorElement instanceof Element);
    const elements = ancestorElement.querySelectorAll(oldName);
    for(const element of elements) {
      domRename(element, newName, copyAttributes);
    }
  }
}
