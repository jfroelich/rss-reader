// Changes the names of certain elements in document content

import coerceElement from "/src/dom/coerce-element.js";
import assert from "/src/assert.js";

// Use shorter names for common elements
// @param copyAttributesFlag {Boolean} optional, if true then copy attributes when renaming
export default function main(doc, copyAttributesFlag) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  coerceElements(doc.body, 'strong', 'b', copyAttributesFlag);
  coerceElements(doc.body, 'em', 'i', copyAttributesFlag);
}

function coerceElements(ancestorElement, oldName, newName, copyAttributesFlag) {
  assert(typeof oldName === 'string');
  assert(typeof newName === 'string');

  // TODO: why this check for definedness of ancestorElement? Should it be always required? I
  // think so. I cannot recall why I did this.

  if(ancestorElement) {
    assert(ancestorElement instanceof Element);
    const elements = ancestorElement.querySelectorAll(oldName);
    for(const element of elements) {
      coerceElement(element, newName, copyAttributesFlag);
    }
  }
}
