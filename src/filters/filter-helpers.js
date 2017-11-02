'use strict';

// import base/errors.js
// import dom.js

function unwrapElements(ancestorElement, selector) {
  if(ancestorElement && selector) {
    const elements = ancestorElement.querySelectorAll(selector);
    for(const element of elements) {
      domUnwrap(element);
    }
  }

  return RDR_OK;
}

function renameElements(ancestorElement, oldName, newName, copyAttributes) {
  console.assert(typeof oldName === 'string');
  console.assert(typeof newName === 'string');

  if(ancestorElement) {
    console.assert(ancestorElement instanceof Element);
    const elements = ancestorElement.querySelectorAll(oldName);
    for(const element of elements) {
      domRename(element, newName, copyAttributes);
    }
  }

  return RDR_OK;
}
