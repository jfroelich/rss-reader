// Helper functions for filters

import assert from "/src/assert.js";
import {renameElement, unwrap} from "/src/dom.js";

export function unwrapElements(ancestorElement, selector) {
  assert(ancestorElement instanceof Element);
  assert(typeof selector === 'string');
  const elements = ancestorElement.querySelectorAll(selector);
  for(const element of elements) {
    unwrap(element);
  }
}

export function renameElements(ancestorElement, oldName, newName, copyAttributes) {
  assert(typeof oldName === 'string');
  assert(typeof newName === 'string');

  if(ancestorElement) {
    assert(ancestorElement instanceof Element);
    const elements = ancestorElement.querySelectorAll(oldName);
    for(const element of elements) {
      renameElement(element, newName, copyAttributes);
    }
  }
}
