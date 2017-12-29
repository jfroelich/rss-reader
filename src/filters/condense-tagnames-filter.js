import coerceElement from "/src/utils/dom/coerce-element.js";
import assert from "/src/common/assert.js";

// Changes the names of certain elements in document content

// TODO: take a look at the following article
// https://blog.usejournal.com/of-svg-minification-and-gzip-21cd26a5d007
// Look into how the html is stored in indexedDB, e.g. what compression, and then reconsider if this
// filter is more harmful than helpful.

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
