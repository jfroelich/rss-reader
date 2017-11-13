
import {assert} from "/src/assert.js";
import {domRename, domUnwrap} from "/src/dom.js";

export function unwrapElements(ancestorElement, selector) {
  assert(ancestorElement instanceof Element);
  assert(typeof selector === 'string');
  const elements = ancestorElement.querySelectorAll(selector);
  for(const element of elements) {
    domUnwrap(element);
  }
}

export function renameElements(ancestorElement, oldName, newName, copyAttributes) {
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
