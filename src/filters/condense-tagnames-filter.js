// Changes the names of certain elements in document content

import {renameElement} from "/src/dom/utils.js";
import assert from "/src/utils/assert.js";

// Use shorter names for common elements
// @param copyAttributesFlag {Boolean} optional, if true then copy attributes when renaming
export default function main(doc, copyAttributesFlag) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  renameElements(doc.body, 'strong', 'b', copyAttributesFlag);
  renameElements(doc.body, 'em', 'i', copyAttributesFlag);
}

function renameElements(ancestorElement, oldName, newName, copyAttributesFlag) {
  assert(typeof oldName === 'string');
  assert(typeof newName === 'string');

  if(ancestorElement) {
    assert(ancestorElement instanceof Element);
    const elements = ancestorElement.querySelectorAll(oldName);
    for(const element of elements) {
      renameElement(element, newName, copyAttributesFlag);
    }
  }
}
