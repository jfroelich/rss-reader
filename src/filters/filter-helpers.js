'use strict';

// import base/assert.js
// import base/errors.js
// import dom.js

function unwrapElements(ancestorElement, selector) {
  // TODO: why the if? do not think it is needed
  if(ancestorElement && selector) {
    assert(ancestorElement instanceof Element);
    assert(typeof selector === 'string');
    const elements = ancestorElement.querySelectorAll(selector);
    for(const element of elements) {
      domUnwrap(element);
    }
  }

  return RDR_OK;
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

  return RDR_OK;
}
